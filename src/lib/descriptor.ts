export function descriptorFromIdentifier(identifier: number) {
  if (identifier >= 2.5) return "Outstanding";
  if (identifier >= 1.5) return "Moderate";
  if (identifier >= 0.9) return "Basic";
  return "";
}

export function identifierFromAssessmentScore(
  formative: number | string | null | undefined,
  summative: number | string | null | undefined,
) {
  const formativeScore = Number(formative ?? 0);
  const summativeScore = Number(summative ?? 0);
  const totalScore = formativeScore + summativeScore;
  return (totalScore / 100) * 3;
}

export function descriptorFromAssessmentScore(
  formative: number | string | null | undefined,
  summative: number | string | null | undefined,
) {
  return descriptorFromIdentifier(identifierFromAssessmentScore(formative, summative));
}
