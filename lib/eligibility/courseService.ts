const COURSES_JSON_URL =
  'https://raw.githubusercontent.com/VATGER-ATD/required-courses/main/courses.json';

/** In-memory cache for the required-courses JSON (10-minute TTL, matching the Python login-monitor). */
let cachedCoursesJson: CourseEntry[] | null = null;
let coursesCacheExpiry = 0;
const COURSES_CACHE_TTL_MS = 10 * 60 * 1000;

interface RequiredCourse {
  name: string;
  /** Full moodle URL, e.g. "https://moodle.vatsim-germany.org/mod/quiz/view.php?id=1269" */
  link: string;
}

interface CourseEntry {
  station: string;
  courses: RequiredCourse[];
  fir: string;
}

async function fetchCoursesJson(): Promise<CourseEntry[]> {
  if (cachedCoursesJson && Date.now() < coursesCacheExpiry) return cachedCoursesJson;

  const res = await fetch(COURSES_JSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch required-courses JSON: ${res.status}`);

  cachedCoursesJson = (await res.json()) as CourseEntry[];
  coursesCacheExpiry = Date.now() + COURSES_CACHE_TTL_MS;
  return cachedCoursesJson;
}

/**
 * Check whether the user has completed a moodle quiz activity.
 * Returns true (= complete / no restriction) when:
 *   - the VATGER_API env var is not configured (graceful degradation), or
 *   - the API call fails for any reason.
 */
async function isCourseComplete(moduleId: string, userCID: number): Promise<boolean> {
  // const base = process.env.VATGER_API;
  // if (!base) return true;

  // const token = process.env.VATGER_API_TOKEN;
  // if (!token) return true;

  // const url = `${base}moodle/activity/${moduleId}/user/${userCID}/completion`;

  // try {
  //   const res = await fetch(url, {
  //     headers: { Authorization: `Token ${token}` },
  //   });
  //   if (!res.ok) return true;
  //   const data = (await res.json()) as { isoverallcomplete?: boolean };
  //   return data.isoverallcomplete === true;
  // } catch (error) {
  //   // Network error or parse error – don't penalise the controller
  //   console.error(`Course completion check failed for module ${moduleId}, CID ${userCID}:`, error);
  //   return true;
  // }
  return false
}

/**
 * Return the names of required courses for a given station callsign that the user
 * has NOT yet completed.  An empty list means nothing to report.
 *
 * @param callsign - e.g. "EDLW_TWR" (built as `${airport}_${level}` by the data loader)
 * @param userCID  - VATSIM CID of the controller
 */
export async function getIncompleteCourseNames(
  callsign: string,
  userCID: number
): Promise<string[]> {
  let all: CourseEntry[];
  try {
    all = await fetchCoursesJson();
  } catch {
    // Graceful degradation: if we cannot fetch the course list, add no restrictions
    return [];
  }

  const entry = all.find((e) => e.station === callsign);
  if (!entry) return [];

  const results = await Promise.all(
    entry.courses.map(async (course) => {
      // Extract the Moodle activity module ID from the URL query string (?id=1269)
      let moduleId: string | null;
      try {
        moduleId = new URL(course.link).searchParams.get('id');
      } catch {
        moduleId = null;
      }
      if (!moduleId) return null;
      const complete = await isCourseComplete(moduleId, userCID);
      return complete ? null : course.name;
    })
  );

  return results.filter((n): n is string => n !== null);
}
