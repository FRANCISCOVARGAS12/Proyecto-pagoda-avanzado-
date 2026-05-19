package com.pagoda.pagoda_api.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    ROL_NO_ENCONTRADO(5001, "Rol no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_ROL_DUPLICADO(5002, "Ya existe un rol con ese nombre", HttpStatus.CONFLICT),

    CATEGORIA_NO_ENCONTRADA(5101, "Categoria no encontrada", HttpStatus.NOT_FOUND),
    NOMBRE_CATEGORIA_DUPLICADO(5102, "Ya existe una categoria con ese nombre", HttpStatus.CONFLICT),

    ESTADO_MESA_NO_ENCONTRADO(5201, "Estado de mesa no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_ESTADO_MESA_DUPLICADO(5202, "Ya existe un estado de mesa con ese nombre", HttpStatus.CONFLICT),

    ESTADO_ITEM_NO_ENCONTRADO(5301, "Estado de item no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_ESTADO_ITEM_DUPLICADO(5302, "Ya existe un estado de item con ese nombre", HttpStatus.CONFLICT),

    METODO_PAGO_NO_ENCONTRADO(5401, "Metodo de pago no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_METODO_PAGO_DUPLICADO(5402, "Ya existe un metodo de pago con ese nombre", HttpStatus.CONFLICT),

    TIPO_COBRO_NO_ENCONTRADO(5501, "Tipo de cobro no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_TIPO_COBRO_DUPLICADO(5502, "Ya existe un tipo de cobro con ese nombre", HttpStatus.CONFLICT),

    MESA_NO_ENCONTRADA(6001, "Mesa no encontrada", HttpStatus.NOT_FOUND),
    NUMERO_MESA_DUPLICADO(6002, "Ya existe una mesa con ese numero", HttpStatus.CONFLICT),
    USUARIO_NO_ENCONTRADO(6003, "Usuario no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_USUARIO_DUPLICADO(6004, "Ya existe un usuario activo con ese nombre", HttpStatus.CONFLICT),
    PRODUCTO_NO_ENCONTRADO(6005, "Producto no encontrado", HttpStatus.NOT_FOUND),
    NOMBRE_PRODUCTO_DUPLICADO(6006, "Ya existe un producto con ese nombre", HttpStatus.CONFLICT),
    PARAMETROS_NO_CONFIGURADOS(6007, "Parametros del local no configurados", HttpStatus.NOT_FOUND),
    PIN_INCORRECTO(6008, "PIN incorrecto", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALIDO(6009, "Sesion invalida o expirada", HttpStatus.UNAUTHORIZED),
    PIN_DUPLICADO(6010, "El PIN ya esta asignado a otro usuario activo", HttpStatus.CONFLICT),
    SUPERUSUARIO_INVALIDO(6011, "Superusuario requerido o invalido", HttpStatus.UNAUTHORIZED),
    SUPERUSUARIO_YA_CONFIGURADO(6012, "La contrasena de superusuario ya esta configurada", HttpStatus.CONFLICT),
    SUPERUSUARIO_NO_CONFIGURADO(6013, "Configura la contrasena de superusuario", HttpStatus.PRECONDITION_REQUIRED),
    CREDENCIALES_INVALIDAS(6014, "Usuario o PIN incorrectos", HttpStatus.UNAUTHORIZED),
    NOMBRE_USUARIO_INACTIVO_DUPLICADO(6015, "Ya existe un usuario inactivo con ese nombre. Ve a Inactivos para reactivarlo o usa otro nombre.", HttpStatus.CONFLICT),
    USUARIO_ACTUAL_NO_DESACTIVABLE(6016, "No puedes desactivar el usuario con el que tienes la sesion iniciada.", HttpStatus.BAD_REQUEST),
    ULTIMO_ADMIN_ACTIVO(6017, "Debe existir al menos un administrador activo.", HttpStatus.BAD_REQUEST),
    PIN_REACTIVACION_REQUERIDO(6018, "Para reactivar un usuario, asigna un PIN nuevo de 6 digitos.", HttpStatus.BAD_REQUEST),

    JORNADA_NO_ENCONTRADA(7001, "Jornada no encontrada", HttpStatus.NOT_FOUND),
    JORNADA_CERRADA(7002, "La jornada ya esta cerrada", HttpStatus.BAD_REQUEST),
    JORNADA_ABIERTA(7003, "La jornada ya esta abierta", HttpStatus.BAD_REQUEST),
    CIERRE_NO_ENCONTRADO(7004, "Cierre de dia no encontrado", HttpStatus.NOT_FOUND),
    CIERRE_YA_EXISTE_PARA_JORNADA(7005, "Ya existe un cierre para la jornada indicada", HttpStatus.CONFLICT),

    VENTA_NO_ENCONTRADA(8001, "Venta no encontrada", HttpStatus.NOT_FOUND),
    VENTA_YA_CERRADA(8002, "La venta ya esta cerrada", HttpStatus.BAD_REQUEST),
    MESA_OCUPADA(8003, "La mesa seleccionada ya tiene una venta activa", HttpStatus.CONFLICT),
    ITEM_NO_ENCONTRADO(8004, "Item de venta no encontrado", HttpStatus.NOT_FOUND),
    PAGO_NO_ENCONTRADO(8005, "Pago no encontrado", HttpStatus.NOT_FOUND),
    MONTO_PAGO_INVALIDO(8006, "El monto del pago debe ser mayor a cero", HttpStatus.BAD_REQUEST),

    REPORTE_NO_ENCONTRADO(9001, "No se encontro el reporte solicitado", HttpStatus.NOT_FOUND),

    ERROR_INTERNO(9999, "Error interno del servidor", HttpStatus.INTERNAL_SERVER_ERROR);


    private Integer code;
    private String msj;
    private HttpStatus httpStatus;


    ErrorCode(Integer code, String msj, HttpStatus httpStatus) {
        this.code = code;
        this.msj = msj;
        this.httpStatus = httpStatus;
    }
}
