from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict | None = None,
        details: any = None,
    ):
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message
        self.details = details


class DomainException:
    @staticmethod
    def event_capacity_exceeded(message: str = "Event capacity has been reached"):
        return AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="EVENT_CAPACITY_EXCEEDED",
            message=message,
        )

    @staticmethod
    def duplicate_registration(message: str = "User is already registered for this event"):
        return AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="DUPLICATE_REGISTRATION",
            message=message,
        )

    @staticmethod
    def resource_already_booked(
        message: str = "The selected resource is already booked for this time period.",
    ):
        return AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="RESOURCE_ALREADY_BOOKED",
            message=message,
        )

    @staticmethod
    def invalid_event_status(message: str = "Invalid event status transition"):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_EVENT_STATUS",
            message=message,
        )

    @staticmethod
    def session_time_conflict(
        message: str = "Another session is already scheduled in this room at that time",
    ):
        return AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="SESSION_TIME_CONFLICT",
            message=message,
        )

    @staticmethod
    def speaker_time_conflict(
        message: str = "The speaker is already assigned to another session at that time",
    ):
        return AppException(
            status_code=status.HTTP_409_CONFLICT,
            code="SPEAKER_TIME_CONFLICT",
            message=message,
        )

    @staticmethod
    def organization_access_denied(
        message: str = "Access denied: you do not have permission for this organization",
    ):
        return AppException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ORGANIZATION_ACCESS_DENIED",
            message=message,
        )

    @staticmethod
    def registration_closed(
        message: str = "Registration for this event is now closed",
    ):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="REGISTRATION_CLOSED",
            message=message,
        )

    @staticmethod
    def event_cancelled(message: str = "The event has been cancelled"):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="EVENT_CANCELLED",
            message=message,
        )

    @staticmethod
    def session_outside_event(
        message: str = "Session timing must be strictly within event start and end time",
    ):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="SESSION_OUTSIDE_EVENT",
            message=message,
        )

    @staticmethod
    def session_capacity_exceeded(
        message: str = "Session capacity cannot exceed room capacity",
    ):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="SESSION_CAPACITY_EXCEEDED",
            message=message,
        )

    @staticmethod
    def resource_not_found(message: str = "Resource not found"):
        return AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="RESOURCE_NOT_FOUND",
            message=message,
        )

    @staticmethod
    def file_too_large(message: str = "Uploaded file exceeds maximum allowed size"):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="FILE_TOO_LARGE",
            message=message,
        )

    @staticmethod
    def invalid_file_type(message: str = "File type or content is not allowed"):
        return AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_FILE_TYPE",
            message=message,
        )
