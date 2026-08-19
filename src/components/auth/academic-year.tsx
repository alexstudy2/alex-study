/**
 * The 1-6 academic year options, shared by the sign-in form and the sign-up wizard.
 *
 * Year 6 is the internship year and is labelled as such rather than as "Year 6" -- it was
 * duplicated in both forms before, which is exactly how the two labels drift apart.
 */
export const ACADEMIC_YEARS = [1, 2, 3, 4, 5, 6] as const;

export function academicYearLabel(year: number, ar: boolean) {
  if (year === 6) return ar ? "سنة الامتياز (Internship)" : "Internship (Intern)";
  return ar ? `السنة ${year}` : `Year ${year}`;
}

export function academicYearOptions(ar: boolean) {
  return ACADEMIC_YEARS.map((year) => (
    <option key={year} value={year}>
      {academicYearLabel(year, ar)}
    </option>
  ));
}
