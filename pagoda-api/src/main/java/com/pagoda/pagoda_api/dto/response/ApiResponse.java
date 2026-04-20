package com.pagoda.pagoda_api.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private T data;
    private Integer errorCode;

    public static <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .errorCode(null)
                .build();
    }

    public static <T> ApiResponse<T> error(String message, Integer errorCode) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .data(null)
                .errorCode(errorCode)
                .build();
    }
}