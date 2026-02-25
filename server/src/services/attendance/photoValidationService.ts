import type {
  AttendanceValidationReason,
  PhotoSelfieRequirements,
  PhotoValidationResult,
  PunchType
} from '../../types/attendance';

export interface PhotoInput {
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface PhotoValidationInput {
  punchType: PunchType;
  settings: PhotoSelfieRequirements;
  photo?: PhotoInput;
}

const reason = (
  code: string,
  message: string,
  severity: 'info' | 'warning' | 'invalid'
): AttendanceValidationReason => ({ code, message, severity });

export const validatePunchPhoto = (input: PhotoValidationInput): PhotoValidationResult => {
  const reasons: AttendanceValidationReason[] = [];

  if (!input.settings.enabled) {
    return {
      isValid: true,
      reasons: [reason('PHOTO_VALIDATION_DISABLED', 'Photo validation is disabled', 'info')]
    };
  }

  const isMandatoryForType =
    (input.punchType === 'IN' && input.settings.mandatoryOnPunchIn) ||
    (input.punchType === 'OUT' && input.settings.mandatoryOnPunchOut);

  const hasPhoto = Boolean(input.photo?.url);

  if (isMandatoryForType && !hasPhoto) {
    reasons.push(reason('PHOTO_REQUIRED', `Photo is required for punch ${input.punchType}`, 'invalid'));
  }

  if (hasPhoto && input.photo?.mimeType) {
    if (!input.settings.allowedMimeTypes.includes(input.photo.mimeType)) {
      reasons.push(reason('PHOTO_MIME_NOT_ALLOWED', 'Photo format is not allowed', 'invalid'));
    }
  }

  if (hasPhoto && input.photo?.sizeBytes) {
    const maxBytes = input.settings.maxFileSizeMb * 1024 * 1024;
    if (input.photo.sizeBytes > maxBytes) {
      reasons.push(
        reason(
          'PHOTO_SIZE_EXCEEDED',
          `Photo exceeds max size ${input.settings.maxFileSizeMb} MB`,
          'invalid'
        )
      );
    }
  }

  if (!reasons.length) {
    reasons.push(reason('PHOTO_VALID', 'Photo validation passed', 'info'));
  }

  return {
    isValid: !reasons.some((entry) => entry.severity === 'invalid'),
    reasons
  };
};
