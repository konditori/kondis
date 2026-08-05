const load = async ({ fetch }) => {
  try {
    const response = await fetch("/api/activities");
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const body = await response.json();
    return { activities: body.activities, unavailable: false };
  } catch {
    return { activities: [], unavailable: true };
  }
};
export {
  load
};
