-- ==========================================
-- ESQUEMA: catalogos
-- ==========================================

INSERT INTO catalogos.roles (nombre, descripcion) VALUES
                                                      ('ADMIN', 'Acceso total al sistema incluyendo panel administrativo'),
                                                      ('MESERO', 'Acceso a la app móvil para gestión de mesas y pedidos')
    ON CONFLICT DO NOTHING;

INSERT INTO catalogos.estados_mesa (nombre) VALUES
                                                ('LIBRE'),
                                                ('OCUPADO'),
                                                ('PIDIENDO_CUENTA'),
                                                ('LIMPIANDO')
    ON CONFLICT DO NOTHING;

INSERT INTO catalogos.estados_item (nombre) VALUES
                                                ('PENDIENTE'),
                                                ('ENVIADO'),
                                                ('CANCELADO')
    ON CONFLICT DO NOTHING;

INSERT INTO catalogos.metodos_pago (nombre) VALUES
                                                ('EFECTIVO'),
                                                ('TARJETA')
    ON CONFLICT DO NOTHING;

INSERT INTO catalogos.tipos_cobro (nombre) VALUES
                                               ('TOTAL'),
                                               ('EQUITATIVO'),
                                               ('POR_PERSONA')
    ON CONFLICT DO NOTHING;

INSERT INTO catalogos.categorias (nombre, descripcion) VALUES
                                                           ('Entradas', 'Platillos para comenzar'),
                                                           ('Rollos', 'Rollos de sushi variados'),
                                                           ('Hot Pot', 'Sopas estilo hot pot individual y familiar'),
                                                           ('Parrilladas', 'Parrilladas asian BBQ y coreana'),
                                                           ('Salsas', 'Salsas y extras'),
                                                           ('Pagoda Kids', 'Menú infantil'),
                                                           ('Postres', 'Postres asiáticos'),
                                                           ('Bebidas Sin Alcohol', 'Refrescos, boba tea y bebidas frías'),
                                                           ('Bebidas Con Alcohol', 'Cervezas, vinos y destilados')
    ON CONFLICT DO NOTHING;

-- ==========================================
-- ESQUEMA: operacion
-- ==========================================

INSERT INTO operacion.parametros_local (
    fondo_lunes, fondo_martes, fondo_miercoles,
    fondo_jueves, fondo_viernes, fondo_sabado, fondo_domingo,
    comision_bancaria
) VALUES (
             1000, 1000, 1000,
             1000, 1000, 1000, 1000,
             3.5
         ) ON CONFLICT DO NOTHING;

INSERT INTO operacion.mesas (numero, capacidad, estado_id) VALUES
                                                               (1, 6, (SELECT id FROM catalogos.estados_mesa WHERE nombre = 'LIBRE')),
                                                               (2, 6, (SELECT id FROM catalogos.estados_mesa WHERE nombre = 'LIBRE')),
                                                               (3, 6, (SELECT id FROM catalogos.estados_mesa WHERE nombre = 'LIBRE')),
                                                               (4, 6, (SELECT id FROM catalogos.estados_mesa WHERE nombre = 'LIBRE'))
    ON CONFLICT DO NOTHING;

-- ==========================================
-- ESQUEMA: operacion - productos
-- ==========================================

-- Entradas
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Dumplings de res', 'Orden de 5 pzas. Pequeñas empanadas de masa fina rellenas de carne de res marinada, cocidas al vapor y espolvoreadas con ajonjolí', 99.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true),
                                                                                        ('Wontong de cangrejo', 'Orden de 5 pzas. Bocadillos de masa fina dorada rellenos de cangrejo y queso crema, salseados con salsa hoisin y coronados con cebollín', 99.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true),
                                                                                        ('Summer roll de camarón', 'Orden de 2 pzas. Rollos fríos de fideo, verduras, hierbas aromáticas tailandesas envueltos en papel de arroz, acompañado de salsa maní', 155.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true),
                                                                                        ('Kushlage de queso', 'Orden de 3 pzas. Brochetas de queso rebosadas y fritas, acompañadas de salsa mayo-chip', 105.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true),
                                                                                        ('Nigiri', 'Orden de 3 pzas. Atún, camarón y salmón. Pequeña base ovalada de arroz con una lámina de pescado crudo y marisco, acompañado de una porción de wasabi', 135.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true),
                                                                                        ('Takoyakis', 'Orden de 5 pzas. Croquetas japonesas de pulpo, salseadas con salsa shiro y espolvoreadas de bonito flakes', 99.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Entradas'), true)
    ON CONFLICT DO NOTHING;

-- Rollos
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Kogyoku', 'Rollo de filete de res, roast beef y queso crema, coronado con mermelada de cereza negra y chicharrón de roast beef', 149.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Namahamu', 'Rollo de pera y queso crema cubierto de jamón serrano y coronado con chicharrón de jamón serrano', 149.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Furai', 'Rollo empanizado con queso mozzarella y queso doble crema, con camarón o res, salseado con nuestra mayo-chip', 145.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Takiyaki', 'Rollo de queso crema y pepino, coronado con salsa tampico y pulpo frito', 139.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Hatake', 'Rollo de camarón, queso crema y aguacate; coronado con tampico y verdura tempurizada', 139.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Uni', 'Rollo de aguacate, queso crema y pepino; cubierto con salmón y atún, coronado con tampico', 135.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Kiro', 'Rollo de camarón, queso crema y masago; cubierto con plátano frito', 129.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Sake', 'Rollo de salmón, aguacate y queso crema; cubierto con pepino y coronado con masago', 129.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('Maguro', 'Rollo de atún, queso crema y pepino; cubierto con aguacate, coronado con seaweed salad y un toque de Furikake', 129.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true),
                                                                                        ('California', 'Rollo de camarón, queso crema y pepino', 119.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Rollos'), true)
    ON CONFLICT DO NOTHING;

-- Hot Pot
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Hot Pot Individual', 'Fondo a elegir: Tom Kha, Tonkotsu o Miso. Proteína a elegir: filete de res, salmón o pechuga de pollo. Pasta a elegir: ramen o harusamen. Incluye porción de huevo, vegetales y naruto', 245.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Hot Pot'), true),
                                                                                        ('Hot Pot Familiar', 'Fondo a elegir: Tom Kha, Tonkotsu o Miso. Proteína a elegir: filete de res, salmón o pechuga de pollo. Pasta a elegir: ramen o harusamen. Incluye porción de huevo, vegetales y naruto. Para 4 personas', 725.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Hot Pot'), true)
    ON CONFLICT DO NOTHING;

-- Parrilladas
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Asian BBQ Individual', 'Incluye filete de res, salmón, pollo y camarón acompañado de vegetales, arroz y kimchi', 495.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Parrilladas'), true),
                                                                                        ('Asian BBQ Familiar', 'Incluye filete de res, salmón, pollo y camarón acompañado de vegetales, arroz y kimchi. Para 4 personas', 965.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Parrilladas'), true),
                                                                                        ('KBBQ Individual', 'Parrillada coreana. Incluye tocineta, filete de res, puerco y puntas de costillas marinadas, acompañado de vegetales, arroz, kimchi y salsa ssamjang', 550.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Parrilladas'), true),
                                                                                        ('KBBQ Familiar', 'Parrillada coreana. Incluye tocineta, filete de res, puerco y puntas de costillas marinadas, acompañado de vegetales, arroz, kimchi y salsa ssamjang. Para 4 personas', 1050.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Parrilladas'), true)
    ON CONFLICT DO NOTHING;

-- Salsas y Extras
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Salsa Ssamjang', 'Salsa coreana', 29.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Salsa Dumpling', 'Salsa para dumplings', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Salsa Ponzu', 'Salsa japonesa cítrica', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Salsa Maní', 'Salsa de cacahuate', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Salsa Hoisin', 'Salsa hoisin', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Salsa Mayo-Chip', 'Salsa mayo chipotle', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Porción huevo, arroz y lechuga', 'Extra de huevo, arroz y lechuga', 25.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Kimchi', 'Extra de kimchi', 23.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true),
                                                                                        ('Wasabi', 'Extra de wasabi', 15.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Salsas'), true)
    ON CONFLICT DO NOTHING;

-- Pagoda Kids
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Nuggets de pollo', 'Orden de 5 pzas', 55.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Pagoda Kids'), true),
                                                                                        ('Baritas de pescado', 'Orden de 5 pzas', 65.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Pagoda Kids'), true)
    ON CONFLICT DO NOTHING;

-- Postres
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Helado de Matcha', 'Helado artesanal de matcha', 55.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Postres'), true),
                                                                                        ('Mango Sago', 'Postre de tapioca, coco y mango', 45.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Postres'), true),
                                                                                        ('Brownie X Baroka', 'Brownie en colaboración con Baroka', 55.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Postres'), true)
    ON CONFLICT DO NOTHING;

-- Bebidas Sin Alcohol
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Coca Cola', 'Refresco', 39.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Coca Cola Zero', 'Refresco sin azúcar', 39.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Manzanita', 'Refresco de manzana', 39.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Boba Tea Leche', 'Bebida con tapioca sabor Taro o Té negro, base leche', 65.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Boba Tea Leche de Coco', 'Bebida con tapioca sabor Taro o Té negro, base leche de coco', 75.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Calpis', 'Bebida japonesa a base de yogurt, mineral o natural', 55.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Okinawa', 'Calpis con maracuyá', 68.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Naranjada', 'Mineral o natural', 45.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Limonada de Yuzu', 'Mineral o natural', 59.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Sakura Té', 'Frío o caliente. Té de flor de hibisco y cereza', 45.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Ramune', 'Bebida japonesa. Preguntar por sabores disponibles', 75.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Bong Bong', 'Bebida coreana con trozos de uva verde', 50.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Haitai', 'Bebida coreana con pulpa de pera', 50.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true),
                                                                                        ('Agua Mineral Perrier', 'Agua mineral con gas', 65.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Sin Alcohol'), true)
    ON CONFLICT DO NOTHING;

-- Bebidas Con Alcohol
INSERT INTO operacion.productos (nombre, descripcion, precio, categoria_id, activo) VALUES
                                                                                        ('Lucky Buddha', 'Cerveza lager de origen chino 360ml', 79.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Sapporo', 'Cerveza lager de origen japonés 360ml', 85.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('XX Lager', 'Cerveza XX Lager 360ml', 69.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('XX Ambar', 'Cerveza XX Ambar 360ml', 69.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Malbec Copa', 'Vino tinto Malbec por copa', 170.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Malbec Botella', 'Vino tinto Malbec botella completa', 800.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Chardonnay Copa', 'Vino blanco Chardonnay por copa', 135.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Chardonnay Botella', 'Vino blanco Chardonnay botella completa', 400.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Umeshu', 'Licor de ciruela japonés caballito 30ml', 60.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true),
                                                                                        ('Soju', 'Destilado coreano botella 360ml', 160.00, (SELECT id FROM catalogos.categorias WHERE nombre = 'Bebidas Con Alcohol'), true)
    ON CONFLICT DO NOTHING;
