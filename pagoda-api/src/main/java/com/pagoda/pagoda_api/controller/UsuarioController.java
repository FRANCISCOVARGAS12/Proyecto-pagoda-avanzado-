package com.pagoda.pagoda_api.controller;

import com.pagoda.pagoda_api.dto.request.UsuarioCreateRequest;
import com.pagoda.pagoda_api.dto.request.UsuarioUpdateRequest;
import com.pagoda.pagoda_api.dto.response.ApiResponse;
import com.pagoda.pagoda_api.dto.response.UsuarioResponse;
import com.pagoda.pagoda_api.entity.catalogos.Rol;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.catalogos.RolRepository;
import com.pagoda.pagoda_api.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operacion/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UsuarioResponse>>> listar() {
        List<UsuarioResponse> response = usuarioService.obtenerTodos().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok("Usuarios obtenidos correctamente", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UsuarioResponse>> obtenerPorId(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Usuario obtenido correctamente", toResponse(usuarioService.obtenerPorId(id))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UsuarioResponse>> crear(@Valid @RequestBody UsuarioCreateRequest request) {
        Rol rol = rolRepository.findById(request.getRolId())
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));

        Usuario usuario = Usuario.builder()
                .nombre(request.getNombre())
                .rol(rol)
                .pinHash(passwordEncoder.encode(request.getPin()))
                .activo(true)
                .build();

        Usuario guardado = usuarioService.guardar(usuario);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Usuario creado correctamente", toResponse(guardado)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UsuarioResponse>> actualizar(@PathVariable Integer id, @Valid @RequestBody UsuarioUpdateRequest request) {
        Rol rol = rolRepository.findById(request.getRolId())
                .orElseThrow(() -> new PagodaException(ErrorCode.ROL_NO_ENCONTRADO));

        Usuario usuario = Usuario.builder()
                .nombre(request.getNombre())
                .rol(rol)
                .pinHash(request.getPin() == null ? null : passwordEncoder.encode(request.getPin()))
                .activo(request.getActivo())
                .build();

        Usuario actualizado = usuarioService.actualizar(id, usuario);
        return ResponseEntity.ok(ApiResponse.ok("Usuario actualizado correctamente", toResponse(actualizado)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> desactivar(@PathVariable Integer id) {
        usuarioService.desactivar(id);
        return ResponseEntity.ok(ApiResponse.ok("Usuario desactivado correctamente", null));
    }

    private UsuarioResponse toResponse(Usuario usuario) {
        return UsuarioResponse.builder()
                .id(usuario.getId())
                .nombre(usuario.getNombre())
                .rol(usuario.getRol() == null ? null : usuario.getRol().getNombre())
                .activo(usuario.getActivo())
                .build();
    }
}


