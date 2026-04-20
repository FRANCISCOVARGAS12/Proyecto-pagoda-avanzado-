package com.pagoda.pagoda_api.exception;

import lombok.Getter;

@Getter
public class PagodaException extends RuntimeException {
    private final ErrorCode errorCode;
    public PagodaException(ErrorCode errorCode) {
        super(errorCode.getMsj());
        this.errorCode = errorCode;
    }
}
