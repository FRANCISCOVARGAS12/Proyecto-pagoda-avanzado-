package com.pagoda.pagoda_api.exception;

import com.pagoda.pagoda_api.dto.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PagodaException.class)
    public ResponseEntity<ApiResponse<?>> handlePagodaException(PagodaException ex) {
        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(ApiResponse.error(
                        ex.getMessage(),
                        ex.getErrorCode().getCode()
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleException(Exception ex) {
        return ResponseEntity
                .status(ErrorCode.ERROR_INTERNO.getHttpStatus())
                .body(ApiResponse.error(
                        ErrorCode.ERROR_INTERNO.getMsj(),
                        ErrorCode.ERROR_INTERNO.getCode()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().isEmpty()
                ? "Solicitud invalida"
                : ex.getBindingResult().getFieldErrors().getFirst().getDefaultMessage();

        return ResponseEntity
                .badRequest()
                .body(ApiResponse.error(message, 4000));
    }
}