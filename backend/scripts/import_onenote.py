"""Bounded OneNote package conversion. HTML is sanitized by the client."""
import base64
import contextlib
import importlib
import io
import json
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
    output = json.dumps({'pages': pages, 'warnings': warnings})
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
