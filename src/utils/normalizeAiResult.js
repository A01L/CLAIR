export function normalizeAiResult(result, originalText = "") {
  const validAppealTypes = [
    "criticism",
    "request",
    "suggestion",
    "bug",
    "anomaly"
  ];

  const validAnomalyTypes = [
    "spam",
    "off_topic",
    "unknown",
    "misinformation",
    "abuse",
    "threat"
  ];

  if (!result || typeof result !== "object") {
    return {
      text: originalText,
      ai_comment: "AI не вернул корректный JSON.",
      appeal_type: "anomaly",
      emotion_rating: 0,
      is_anomaly: true,
      anomaly_type: "unknown",
      anomaly_comment: "Ответ AI невозможно нормально обработать.",
      status: "new",
      ai_solution: "Передать обращение на ручную проверку."
    };
  }

  const normalized = { ...result };

  normalized.text =
    typeof normalized.text === "string" && normalized.text.trim()
      ? normalized.text.trim()
      : originalText;

  normalized.ai_comment =
    typeof normalized.ai_comment === "string"
      ? normalized.ai_comment.trim()
      : "";

  normalized.ai_solution =
    typeof normalized.ai_solution === "string"
      ? normalized.ai_solution.trim()
      : "";

  normalized.status = "new";

  normalized.is_anomaly =
    typeof normalized.is_anomaly === "boolean"
      ? normalized.is_anomaly
      : Boolean(normalized.is_anomaly);

  if (!validAppealTypes.includes(normalized.appeal_type)) {
    normalized.appeal_type = normalized.is_anomaly ? "anomaly" : "criticism";
  }

  if (normalized.is_anomaly === true) {
    normalized.appeal_type = "anomaly";

    if (!validAnomalyTypes.includes(normalized.anomaly_type)) {
      normalized.anomaly_type = "unknown";
    }

    if (
      ["spam", "off_topic", "unknown", "abuse"].includes(
        normalized.anomaly_type
      )
    ) {
      normalized.emotion_rating = 0;
    }

    if (normalized.anomaly_type === "misinformation") {
      normalized.emotion_rating = 3;
    }

    if (normalized.anomaly_type === "threat") {
      normalized.emotion_rating = 5;
    }

    if (
      typeof normalized.anomaly_comment !== "string" ||
      !normalized.anomaly_comment.trim()
    ) {
      normalized.anomaly_comment = "Обращение помечено как аномалия.";
    } else {
      normalized.anomaly_comment = normalized.anomaly_comment.trim();
    }
  }

  if (normalized.is_anomaly === false) {
    if (normalized.appeal_type === "anomaly") {
      normalized.appeal_type = "criticism";
    }

    normalized.anomaly_type = null;
    normalized.anomaly_comment = null;

    const rating = Number(normalized.emotion_rating);

    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      normalized.emotion_rating = 1;
    } else {
      normalized.emotion_rating = rating;
    }
  }

  return normalized;
}