"""Bounded OneNote package conversion. HTML is sanitized by the client."""
import base64
import contextlib
import importlib
import io
import json
import os
import pathlib
import struct
import subprocess
import sys


def validate_package(filename):
    data = pathlib.Path(filename).read_bytes()
    if len(data) < 36 or data[:4] != b'MSCF':
        raise ValueError('Choose a valid OneNote .onepkg notebook package.')
    offset = struct.unpack_from('<I', data, 16)[0]
    count, flags = struct.unpack_from('<HH', data, 28)
    if flags & 3 or count > 1024:
        raise ValueError('Multi-volume or oversized notebook archives are not supported.')
    total, names = 0, set()
    for _ in range(count):
        if offset + 16 > len(data):
            raise ValueError('The notebook archive is incomplete.')
        size = struct.unpack_from('<I', data, offset)[0]
        end = data.find(b'\0', offset + 16)
        if end < 0:
            raise ValueError('Invalid notebook archive directory.')
        name = data[offset + 16:end].decode('utf-8', errors='replace').replace('\\', '/')
        parts = name.split('/')
        if (name.startswith('/') or ':' in name or any(p in ('', '.', '..') or p.endswith((' ', '.'))
                or p.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *('COM'+str(n) for n in range(10)), *('LPT'+str(n) for n in range(10))} for p in parts)
                or name.casefold() in names):
            raise ValueError('The notebook contains unsafe or duplicate archive paths.')
        names.add(name.casefold())
        total += size
        if total > 100 * 1024 * 1024:
            raise ValueError('The expanded notebook exceeds the 100 MB import limit.')
        offset = end + 1


def main():
    source = pathlib.Path(sys.argv[1])
    is_section = source.suffix.lower() == '.one'
    if not is_section:
        validate_package(sys.argv[1])
    converter = importlib.import_module('onenote_tool.convert')
    original_run = subprocess.run
    def bounded_run(*args, **kwargs):
        kwargs['timeout'] = 40
        return original_run(*args, **kwargs)
    subprocess.run = bounded_run
    compatibility = len(sys.argv) > 3 and sys.argv[3] == 'compatibility'
    if not compatibility:
        if sys.platform != 'win32':
            raise ValueError('Preserving OneNote annotations requires the backend to run on Windows with desktop OneNote installed. Export to PDF in OneNote and upload that PDF, or explicitly choose compatibility import.')
        work = pathlib.Path(sys.argv[2])
        work.mkdir(parents=True, exist_ok=True)
        with contextlib.redirect_stdout(io.StringIO()):
            if is_section:
                section_paths = [str(source)]
            else:
                section_paths = converter.unpack_onepkg(str(source), str(work))
        sections_manifest = source.parent / 'sections.json'
        sections_manifest.write_text(json.dumps(section_paths), encoding='utf-8')
        output_directory = source.parent / 'native-pdf'
        output_directory.mkdir()
        script = pathlib.Path(__file__).with_name('export_onenote.ps1')
        powershell = str(pathlib.Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32/WindowsPowerShell/v1.0/powershell.exe')
        try:
            native = original_run([powershell, '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', str(script), '-SectionsManifest', str(sections_manifest), '-OutputDirectory', str(output_directory)], capture_output=True, timeout=100)
        except (OSError, subprocess.TimeoutExpired):
            raise ValueError('OneNote desktop export could not finish. Open desktop OneNote and retry, or export your notes as PDF and upload that PDF. Compatibility import may lose annotations.')
        if native.returncode:
            raise ValueError('Desktop OneNote could not export all pages. Make sure OneNote for Windows is installed and opens normally, and unlock protected sections. To retain annotations, export as PDF in OneNote and upload the PDF. Compatibility import may lose annotations.')
        manifest = json.loads((output_directory / 'manifest.json').read_text(encoding='utf-8-sig'))
        for page in manifest['pages']:
            pdf_path = output_directory / page.pop('pdfFile')
            pdf = pdf_path.read_bytes()
            if not pdf.startswith(b'%PDF-'):
                raise ValueError('OneNote returned an invalid page export. Import stopped to avoid saving incomplete notes.')
            page['pdfData'] = base64.b64encode(pdf).decode('ascii')
            page['html'] = ''
        manifest['mode'] = 'native'
        manifest['warnings'] = ['Exported with desktop OneNote. Ink, highlights, and printouts are rendered into the PDF; imported strokes are not separately editable. Review the pages before saving.']
        output = json.dumps(manifest)
        if len(output.encode('utf-8')) > 24 * 1024 * 1024:
            raise ValueError('The exported notes are too large. Export smaller sections.')
        print(output)
        return
    # Redirect library output so stdout contains only our JSON response.
    with contextlib.redirect_stdout(io.StringIO()):
        if is_section:
            from onenote_tool.models import ConversionResult
            converter.require_pyonenote()
            result = ConversionResult(notebook_name=source.stem)
            sizes = {str(source): source.stat().st_size}
            converter.process_sections([str(source)], result, str(source.parent), None, sizes, 0)
            if any(str(kind).startswith('section_parse_error:') for kind in result.report.failed):
                raise ValueError('This .one section could not be read. Export a fresh copy from OneNote desktop, or export it as PDF.')
            if not result.sections or all(not section.pages for section in result.sections):
                raise ValueError('No readable pages were found. Choose an unprotected OneNote .one section.')
        else:
            result = converter.convert_onepkg(sys.argv[1], work_dir=sys.argv[2])
    pages, warnings = [], ['Review the preview before saving. OneNote layouts and handwriting may change during conversion. Embedded files, audio, and video are not imported.']
    for section in result.sections:
        if section.password_status:
            warnings.append('Protected section skipped: ' + section.name + '. Export an unprotected copy to include it.')
        for page in section.pages:
            if len(pages) >= 200:
                raise ValueError('This notebook has more than 200 pages. Export smaller notebook packages.')
            html = ''.join(block.get('html', '') for block in page.blocks if block.get('kind') not in ('audio', 'video', 'file_links'))
            for image in page.images:
                # Only raster image formats are embedded; SVG ink is sanitized separately.
                mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp'}.get(image.ext.lower())
                html = html.replace(image.ref, 'data:' + mime + ';base64,' + base64.b64encode(image.data).decode('ascii') if mime else '')
            pages.append({'title': page.title or 'Untitled page', 'section': ' / '.join([*section.group_path, section.name]), 'html': html})
    if result.report.failed:
        warnings.append('Some elements could not be converted: ' + ', '.join(str(k) for k in result.report.failed)[:1000])
    if not pages:
        raise ValueError('No readable pages were found. Export an unprotected .one section or .onepkg notebook from OneNote desktop.')
    output = json.dumps({'pages': pages, 'warnings': warnings, 'mode': 'compatibility'})
    if len(output.encode('utf-8')) > 24 * 1024 * 1024:
        raise ValueError('The converted notebook is too large. Export smaller notebook packages.')
    print(output)


if __name__ == '__main__':
    try:
        main()
    except ModuleNotFoundError:
        print(json.dumps({'error': 'OneNote importer is not installed. Follow the OneNote setup in README.md.'}))
        sys.exit(1)
    except Exception as error:
        print(json.dumps({'error': str(error)[:500]}))
        sys.exit(1)
