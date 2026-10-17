// Read a response once and distinguish a missing backend response from bad data.
export async function readApiJson(response) {
  let endpoint='API request';
  try {endpoint=new URL(response.url).pathname}catch{}
  const body=await response.text();
  if(!body.trim())throw new Error(`${endpoint} returned an empty response (HTTP ${response.status}). Check that the backend is running and restart it after updating. Refresh the task list before retrying a deletion.`);
  try {return JSON.parse(body)}catch{
    throw new Error(`${endpoint} returned invalid JSON (HTTP ${response.status}). Check that API requests reach the updated backend, rather than the frontend or an error page.`);
  }
}
