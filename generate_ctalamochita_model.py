"""
Generador de Modelo 3D de Río Ctalamochita entre Villa María y Villa Nueva
Estilo: QGIS Cartographic DEM Relief 3D
Ejecución: Blender 4.3 Headless Python API (bpy)
"""

import bpy
import bmesh
import math
import random
import os
import sys

def main():
    print("=== INICIANDO GENERACIÓN 3D: RÍO CTALAMOCHITA (VILLA MARÍA - VILLA NUEVA) ===")

    # 1. Resetear escena
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Crear colección principal
    coll = bpy.data.collections.new("Ctalamochita_GIS_Scene")
    bpy.context.scene.collection.children.link(coll)

    # -------------------------------------------------------------
    # MATERIALES
    # -------------------------------------------------------------
    def make_material(name, color, roughness=0.6, metallic=0.0, transmission=0.0, emission=None, alpha=1.0):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*color[:3], alpha)
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metallic
            if "Transmission Weight" in bsdf.inputs:
                bsdf.inputs["Transmission Weight"].default_value = transmission
            elif "Transmission" in bsdf.inputs:
                bsdf.inputs["Transmission"].default_value = transmission
            if emission and "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission[:3], 1.0)
                if "Emission Strength" in bsdf.inputs:
                    bsdf.inputs["Emission Strength"].default_value = 2.0
        return mat

    # Terreno con nodo de Color Attribute
    mat_terrain = bpy.data.materials.new(name="Mat_QGIS_Terrain")
    mat_terrain.use_nodes = True
    nodes_t = mat_terrain.node_tree.nodes
    links_t = mat_terrain.node_tree.links
    bsdf_t = nodes_t.get("Principled BSDF")
    attr_node = nodes_t.new(type="ShaderNodeAttribute")
    attr_node.attribute_name = "QGIS_Hypsometric"
    if bsdf_t:
        links_t.new(attr_node.outputs["Color"], bsdf_t.inputs["Base Color"])
        bsdf_t.inputs["Roughness"].default_value = 0.7

    mat_water = make_material("Mat_Ctalamochita_Water", (0.10, 0.45, 0.65), roughness=0.15, metallic=0.1, transmission=0.4, alpha=0.85)
    mat_sand = make_material("Mat_River_Sand", (0.82, 0.74, 0.55), roughness=0.85)
    mat_podium = make_material("Mat_GIS_Podium", (0.12, 0.14, 0.16), roughness=0.5)
    mat_bridge = make_material("Mat_Bridge_Structure", (0.75, 0.75, 0.78), roughness=0.3, metallic=0.6)
    mat_bridge_red = make_material("Mat_Puente_Alberdi", (0.72, 0.22, 0.18), roughness=0.4, metallic=0.3)
    mat_urban_vm = make_material("Mat_Villa_Maria_Urban", (0.85, 0.82, 0.78), roughness=0.5)
    mat_urban_vn = make_material("Mat_Villa_Nueva_Urban", (0.78, 0.75, 0.70), roughness=0.5)
    mat_foliage = make_material("Mat_Riparian_Willow", (0.22, 0.48, 0.24), roughness=0.6)
    mat_trunk = make_material("Mat_Tree_Trunk", (0.35, 0.25, 0.15), roughness=0.9)
    mat_marker = make_material("Mat_Audio_Beacon", (0.95, 0.75, 0.10), roughness=0.2, emission=(1.0, 0.8, 0.2))
    mat_frame_text = make_material("Mat_GIS_Label", (0.92, 0.94, 0.96), roughness=0.3, emission=(0.9, 0.9, 1.0))

    # -------------------------------------------------------------
    # GEOMETRÍA DEL RELIEVE Y RÍO CTALAMOCHITA (DEM QGIS)
    # -------------------------------------------------------------
    # Villa María está al noreste (Y > 0), Villa Nueva al sudoeste (Y < 0)
    # El río corre de Oeste a Este formando meandros característicos
    # Ancho del modelo: 30 x 24 unidades (representa aprox. 6km x 4.8km)
    
    W_X = 28.0
    W_Y = 22.0
    RES_X = 140
    RES_Y = 110
    
    dx = W_X / (RES_X - 1)
    dy = W_Y / (RES_Y - 1)
    x_min = -W_X / 2.0
    y_min = -W_Y / 2.0
    
    # Función que define la trayectoria central del río Ctalamochita
    # El meandro principal se arquea hacia el norte en el balneario de Villa María
    # y abraza el Parque Hipólito Yrigoyen de Villa Nueva
    def river_center_y(x):
        # x va de -14 a +14
        # Curvatura sinuosa típica del tramo urbano
        t = x / 14.0  # -1 a +1
        # Combinación de ondas para recrear los meandros reales
        y = 3.2 * math.sin(t * 2.4 - 0.3) + 1.8 * math.sin(t * 4.8 + 1.1) - 0.8 * (t ** 2) + 0.4
        return y

    def river_width(x):
        # Ancho variable del río con ensanches en balneario
        t = x / 14.0
        base_w = 1.6 + 0.8 * math.exp(-((t - 0.1)**2) / 0.08) + 0.4 * math.sin(t * 3.0)
        return max(1.2, base_w)

    def elevation(x, y):
        # Cota de elevación del terreno en metros relativos
        # Altura base meseta de Villa María (norte): ~2.2 a 2.8
        # Altura llanura aluvial de Villa Nueva (sur): ~1.8 a 2.4
        ry = river_center_y(x)
        rw = river_width(x)
        dist_to_river = abs(y - ry)
        
        # Suave gradiente regional (hacia el este desciende la pendiente de la cuenca)
        regional_slope = -0.04 * x
        
        # Terraza de Villa María (noreste) ligeramente más alta que la de Villa Nueva
        bank_bias = 0.35 if y > ry else -0.15
        
        base_z = 2.2 + regional_slope + bank_bias
        
        # Suave ondulación topográfica pampeana
        noise = 0.15 * math.sin(x * 0.4 + y * 0.3) + 0.10 * math.sin(x * 0.8 - y * 0.6)
        base_z += noise
        
        # Caja del lecho fluvial del río
        if dist_to_river < rw * 0.55:
            # En el agua / lecho profundo
            # Perfil en U suavizada
            ratio = dist_to_river / (rw * 0.55)
            # Bancos de arena e islas
            island_factor = 0.0
            if abs(x - 0.5) < 2.0 and abs(y - ry) < 0.4:
                # Banco de arena en el meandro central
                island_factor = 0.45 * math.cos((x - 0.5) * math.pi / 2.0)
            river_bed_z = 0.35 + 0.45 * (ratio ** 2) + island_factor
            return river_bed_z
        elif dist_to_river < rw * 1.5:
            # Barrancas y riberas (transición escarpada / suave)
            t_bank = (dist_to_river - rw * 0.55) / (rw * 0.95)
            # Curva sigmoide suave
            s = 0.5 - 0.5 * math.cos(t_bank * math.pi)
            water_edge_z = 0.8
            return water_edge_z + (base_z - water_edge_z) * s
        else:
            return base_z

    # Cuantización QGIS (estilo terrazas de curvas de nivel cada 0.25 unidades)
    def qgis_contour_stepped_elevation(x, y):
        raw_z = elevation(x, y)
        ry = river_center_y(x)
        rw = river_width(x)
        dist_to_river = abs(y - ry)
        
        # En el lecho del río dejamos suave para la corriente
        if dist_to_river < rw * 0.8:
            return raw_z
        
        # Estilo cartográfico: micro-escalonamiento sutil que simula isolíneas DEM QGIS
        step = 0.30
        stepped = math.floor(raw_z / step) * step
        # Mezcla suave para mantener relieve natural pero con terrazas visibles
        return raw_z * 0.70 + stepped * 0.30

    print("Generando malla de terreno DEM...")
    mesh_terrain = bpy.data.meshes.new("Ctalamochita_DEM_Terrain")
    bm_t = bmesh.new()

    # Grid vertices
    vert_grid = []
    water_level = 0.78
    
    for j in range(RES_Y):
        row = []
        y = y_min + j * dy
        for i in range(RES_X):
            x = x_min + i * dx
            z = qgis_contour_stepped_elevation(x, y)
            v = bm_t.verts.new((x, y, z))
            row.append(v)
        vert_grid.append(row)

    bm_t.verts.ensure_lookup_table()

    # Caras del terreno
    for j in range(RES_Y - 1):
        for i in range(RES_X - 1):
            v0 = vert_grid[j][i]
            v1 = vert_grid[j][i + 1]
            v2 = vert_grid[j + 1][i + 1]
            v3 = vert_grid[j + 1][i]
            bm_t.faces.new((v0, v1, v2, v3))

    # Extrusión hacia abajo para crear el podio de corte geológico QGIS (block diagram)
    base_floor_z = -1.8
    # Crear borde perimetral hacia abajo
    # Borde inferior (y_min)
    for i in range(RES_X - 1):
        va = vert_grid[0][i]
        vb = vert_grid[0][i + 1]
        vba_f = bm_t.verts.new((va.co.x, va.co.y, base_floor_z))
        vbb_f = bm_t.verts.new((vb.co.x, vb.co.y, base_floor_z))
        bm_t.faces.new((va, vba_f, vbb_f, vb))

    # Borde superior (y_max)
    for i in range(RES_X - 1):
        va = vert_grid[RES_Y - 1][i]
        vb = vert_grid[RES_Y - 1][i + 1]
        vba_f = bm_t.verts.new((va.co.x, va.co.y, base_floor_z))
        vbb_f = bm_t.verts.new((vb.co.x, vb.co.y, base_floor_z))
        bm_t.faces.new((va, vb, vbb_f, vba_f))

    # Borde izquierdo (x_min)
    for j in range(RES_Y - 1):
        va = vert_grid[j][0]
        vb = vert_grid[j + 1][0]
        vba_f = bm_t.verts.new((va.co.x, va.co.y, base_floor_z))
        vbb_f = bm_t.verts.new((vb.co.x, vb.co.y, base_floor_z))
        bm_t.faces.new((va, vb, vbb_f, vba_f))

    # Borde derecho (x_max)
    for j in range(RES_Y - 1):
        va = vert_grid[j][RES_X - 1]
        vb = vert_grid[j + 1][RES_X - 1]
        vba_f = bm_t.verts.new((va.co.x, va.co.y, base_floor_z))
        vbb_f = bm_t.verts.new((vb.co.x, vb.co.y, base_floor_z))
        bm_t.faces.new((va, vba_f, vbb_f, vb))

    # Cara inferior del bloque
    v_c0 = bm_t.verts.new((x_min, y_min, base_floor_z))
    v_c1 = bm_t.verts.new((-x_min, y_min, base_floor_z))
    v_c2 = bm_t.verts.new((-x_min, -y_min, base_floor_z))
    v_c3 = bm_t.verts.new((x_min, -y_min, base_floor_z))
    bm_t.faces.new((v_c0, v_c3, v_c2, v_c1))

    # Colores de vértices (Rampa Hipsométrica QGIS - DEM)
    bmesh.ops.recalc_face_normals(bm_t, faces=bm_t.faces)
    bm_t.to_mesh(mesh_terrain)
    bm_t.free()

    # Añadir atributos de color hipsométricos (Elevation Ramp)
    color_layer = mesh_terrain.color_attributes.new(name="QGIS_Hypsometric", type='BYTE_COLOR', domain='CORNER')
    
    # Asignar colores según altura y cercanía al río
    for poly in mesh_terrain.polygons:
        for loop_idx in poly.loop_indices:
            v_idx = mesh_terrain.loops[loop_idx].vertex_index
            vx, vy, vz = mesh_terrain.vertices[v_idx].co
            
            if vz <= base_floor_z + 0.05:
                # Base del podio: gris oscuro cartográfico
                col = (0.12, 0.14, 0.16, 1.0)
            elif vz < base_floor_z + 0.5:
                # Faldón lateral
                col = (0.20, 0.22, 0.25, 1.0)
            else:
                ry = river_center_y(vx)
                rw = river_width(vx)
                dist_r = abs(vy - ry)
                
                if vz <= water_level + 0.05 or dist_r < rw * 0.55:
                    # Lecho de río y bancos arenosos
                    col = (0.84, 0.76, 0.58, 1.0) # Arena dorada
                elif dist_r < rw * 0.95:
                    # Ribera y bosque de sauces
                    col = (0.32, 0.62, 0.35, 1.0) # Verde aluvial brillante
                elif vz < 1.6:
                    # Llanura de inundación baja
                    col = (0.48, 0.68, 0.38, 1.0)
                elif vz < 2.3:
                    # Terrazas intermedias de Villa María / Villa Nueva
                    col = (0.62, 0.72, 0.48, 1.0)
                else:
                    # Cota más alta (interfluvio)
                    col = (0.76, 0.74, 0.58, 1.0)
                    
            color_layer.data[loop_idx].color = col

    obj_terrain = bpy.data.objects.new("Terreno_Ctalamochita_DEM", mesh_terrain)
    obj_terrain.data.materials.append(mat_terrain)
    coll.objects.link(obj_terrain)

    # -------------------------------------------------------------
    # 2. MALLA DE AGUA DEL RÍO CTALAMOCHITA (ESPEJO DE AGUA)
    # -------------------------------------------------------------
    print("Generando lámina de agua de la cuenca...")
    mesh_water = bpy.data.meshes.new("Rio_Ctalamochita_Agua")
    bm_w = bmesh.new()

    # Crearemos una cinta de agua que sigue el curso exacto del meandro
    STEPS_R = 120
    x_start = x_min
    x_end = -x_min
    dx_w = (x_end - x_start) / (STEPS_R - 1)
    
    water_verts_l = []
    water_verts_r = []

    for step in range(STEPS_R):
        wx = x_start + step * dx_w
        wy = river_center_y(wx)
        w_width = river_width(wx) * 0.56
        
        vl = bm_w.verts.new((wx, wy - w_width, water_level))
        vr = bm_w.verts.new((wx, wy + w_width, water_level))
        water_verts_l.append(vl)
        water_verts_r.append(vr)

    for step in range(STEPS_R - 1):
        v0 = water_verts_l[step]
        v1 = water_verts_r[step]
        v2 = water_verts_r[step + 1]
        v3 = water_verts_l[step + 1]
        bm_w.faces.new((v0, v1, v2, v3))

    bmesh.ops.recalc_face_normals(bm_w, faces=bm_w.faces)
    bm_w.to_mesh(mesh_water)
    bm_w.free()

    obj_water = bpy.data.objects.new("Rio_Ctalamochita_Agua", mesh_water)
    obj_water.data.materials.append(mat_water)
    coll.objects.link(obj_water)

    # -------------------------------------------------------------
    # 3. PUENTES CONECTORES ENTRE VILLA MARÍA Y VILLA NUEVA
    # -------------------------------------------------------------
    # 1. Puente Alberdi (Histórico - icónico arco/tirantes)
    # 2. Puente Juan Domingo Perón (Acceso principal central)
    # 3. Puente Negro (Ferroviario histórico)
    # 4. Puente Carretero / Vélez Sarsfield
    bridges = [
        {"name": "Puente_Alberdi_Historico", "x": 3.8, "mat": mat_bridge_red, "arch": True, "label": "Puente Alberdi (1918)"},
        {"name": "Puente_Juan_Domingo_Peron", "x": -0.8, "mat": mat_bridge, "arch": False, "label": "Puente Juan D. Perón"},
        {"name": "Puente_Negro_Ferroviario", "x": -6.5, "mat": mat_podium, "arch": True, "label": "Puente Negro (Ferrocarril)"},
        {"name": "Puente_Velez_Sarsfield", "x": 8.5, "mat": mat_bridge, "arch": False, "label": "Puente Vélez Sarsfield"}
    ]

    print("Construyendo puentes interurbanos...")
    for br in bridges:
        bx = br["x"]
        by = river_center_y(bx)
        rw = river_width(bx) * 0.70
        
        # Tablero del puente
        b_mesh = bpy.data.meshes.new(br["name"])
        bm_b = bmesh.new()
        
        deck_w = 0.42
        deck_len = rw * 2.2
        deck_z = water_level + 0.65
        
        # Puntos del puente (conectando ribera sur y norte)
        p0 = (-deck_w/2, -deck_len/2, 0)
        p1 = (deck_w/2, -deck_len/2, 0)
        p2 = (deck_w/2, deck_len/2, 0)
        p3 = (-deck_w/2, deck_len/2, 0)
        
        # Crear cubo alargado para el tablero
        b_cube = bmesh.ops.create_cube(bm_b, size=1.0)
        # Escalar a dimensiones de puente
        for v in bm_b.verts:
            v.co.x *= deck_w
            v.co.y *= deck_len
            v.co.z *= 0.12
            v.co.z += deck_z
            
        # Pilares en el agua
        pilar1 = bmesh.ops.create_cube(bm_b, size=1.0)
        for v in pilar1['verts']:
            v.co.x *= 0.28
            v.co.y *= 0.28
            v.co.z *= (deck_z - 0.2)
            v.co.z += deck_z / 2.0
            v.co.y -= rw * 0.4
            
        pilar2 = bmesh.ops.create_cube(bm_b, size=1.0)
        for v in pilar2['verts']:
            v.co.x *= 0.28
            v.co.y *= 0.28
            v.co.z *= (deck_z - 0.2)
            v.co.z += deck_z / 2.0
            v.co.y += rw * 0.4

        # Arcos o barandas si es puente histórico
        if br["arch"]:
            # Arcos laterales icónicos
            arch_pts = 10
            for side in [-1, 1]:
                arc_v = []
                for a_i in range(arch_pts):
                    frac = a_i / (arch_pts - 1)
                    ay = (frac - 0.5) * (deck_len * 0.8)
                    az = deck_z + 0.6 * math.sin(frac * math.pi)
                    ax = side * (deck_w * 0.48)
                    arc_v.append((ax, ay, az))
                # Baranda en arco
                for a_i in range(arch_pts - 1):
                    va = bm_b.verts.new(arc_v[a_i])
                    vb = bm_b.verts.new(arc_v[a_i + 1])
                    va_up = bm_b.verts.new((arc_v[a_i][0], arc_v[a_i][1], arc_v[a_i][2] + 0.08))
                    vb_up = bm_b.verts.new((arc_v[a_i+1][0], arc_v[a_i+1][1], arc_v[a_i+1][2] + 0.08))
                    bm_b.faces.new((va, vb, vb_up, va_up))

        bm_b.to_mesh(b_mesh)
        bm_b.free()
        
        b_obj = bpy.data.objects.new(br["name"], b_mesh)
        b_obj.location = (bx, by, 0)
        b_obj.data.materials.append(br["mat"])
        coll.objects.link(b_obj)

    # -------------------------------------------------------------
    # 4. MANZANAS URBANAS Y TRAZA TERRITORIAL (VILLA MARÍA & VILLA NUEVA)
    # -------------------------------------------------------------
    print("Creando tramas urbanas de Villa María y Villa Nueva...")
    # Villa María (Norte del río): Manzanas en cuadrícula orientada
    vm_mesh = bpy.data.meshes.new("Urbano_Villa_Maria")
    bm_vm = bmesh.new()

    random.seed(42)
    # Bloques de Villa María
    for bx in range(-12, 13, 2):
        for by in range(2, 10, 2):
            cx = bx + 0.1 * random.uniform(-1, 1)
            cy = by + 0.1 * random.uniform(-1, 1)
            # Solo si está a cierta distancia del río (respetar la Costanera)
            ry = river_center_y(cx)
            if cy > ry + river_width(cx) * 0.8 + 0.6:
                h = random.uniform(0.3, 0.95)
                # Edificios emblemáticos más altos cerca de la costanera
                if abs(cx) < 3.0 and cy < ry + 3.0:
                    h = random.uniform(0.8, 1.6)
                
                b_cube = bmesh.ops.create_cube(bm_vm, size=1.0)
                z_base = elevation(cx, cy)
                for v in b_cube['verts']:
                    v.co.x = v.co.x * 1.35 + cx
                    v.co.y = v.co.y * 1.35 + cy
                    v.co.z = v.co.z * h + (z_base + h/2.0)

    bm_vm.to_mesh(vm_mesh)
    bm_vm.free()
    obj_vm = bpy.data.objects.new("Urbano_Villa_Maria", vm_mesh)
    obj_vm.data.materials.append(mat_urban_vm)
    coll.objects.link(obj_vm)

    # Villa Nueva (Sur del río): Trama urbana histórica
    vn_mesh = bpy.data.meshes.new("Urbano_Villa_Nueva")
    bm_vn = bmesh.new()

    for bx in range(-11, 11, 2):
        for by in range(-9, -2, 2):
            cx = bx + 0.1 * random.uniform(-1, 1)
            cy = by + 0.1 * random.uniform(-1, 1)
            ry = river_center_y(cx)
            # Respetar el Parque Hipólito Yrigoyen y ribera
            if cy < ry - river_width(cx) * 0.8 - 0.7:
                h = random.uniform(0.25, 0.65)
                b_cube = bmesh.ops.create_cube(bm_vn, size=1.0)
                z_base = elevation(cx, cy)
                for v in b_cube['verts']:
                    v.co.x = v.co.x * 1.30 + cx
                    v.co.y = v.co.y * 1.30 + cy
                    v.co.z = v.co.z * h + (z_base + h/2.0)

    bm_vn.to_mesh(vn_mesh)
    bm_vn.free()
    obj_vn = bpy.data.objects.new("Urbano_Villa_Nueva", vn_mesh)
    obj_vn.data.materials.append(mat_urban_vn)
    coll.objects.link(obj_vn)

    # -------------------------------------------------------------
    # 5. VEGETACIÓN DE RIBERA: SAUCES CRIOLLOS Y MONTE RIBEREÑO
    # -------------------------------------------------------------
    print("Colocando arboledas de Sauces y bosque en galería...")
    tree_mesh = bpy.data.meshes.new("Vegetacion_Sauces_Criollos")
    bm_tree = bmesh.new()

    for i in range(160):
        tx = random.uniform(-13.0, 13.0)
        ry = river_center_y(tx)
        rw = river_width(tx)
        # Colocar a los márgenes del río (Costanera de VM y Parque Yrigoyen de VN)
        side = 1 if random.random() > 0.45 else -1
        dist = rw * 0.65 + random.uniform(0.1, 1.4)
        ty = ry + side * dist
        tz = elevation(tx, ty)
        
        scale = random.uniform(0.35, 0.75)
        # Copa de sauce (elipsoide caído)
        fol = bmesh.ops.create_icosphere(bm_tree, subdivisions=1, radius=scale)
        for v in fol['verts']:
            v.co.x += tx
            v.co.y += ty
            v.co.z = v.co.z * 1.3 + tz + scale * 1.2
            
        # Tronco
        trunk = bmesh.ops.create_cube(bm_tree, size=1.0)
        for v in trunk['verts']:
            v.co.x = v.co.x * 0.08 + tx
            v.co.y = v.co.y * 0.08 + ty
            v.co.z = v.co.z * (scale * 0.8) + (tz + scale * 0.4)

    bm_tree.to_mesh(tree_mesh)
    bm_tree.free()
    obj_tree = bpy.data.objects.new("Vegetacion_Sauces_Costanera", tree_mesh)
    obj_tree.data.materials.append(mat_foliage)
    coll.objects.link(obj_tree)

    # -------------------------------------------------------------
    # 6. HITOS CARTOGRÁFICOS Y PUNTOS DE REGISTRO SONORO (BEACONS)
    # -------------------------------------------------------------
    # Puntos específicos de grabación de campo a lo largo del río
    field_recordings = [
        {
            "id": "rec_01",
            "name": "Balneario Municipal (Villa María)",
            "x": 0.8,
            "y": river_center_y(0.8) + 1.1,
            "desc": "Rumor del río en el lecho arenoso y cantos de Zorzal Colorado",
            "audio_type": "river_birds"
        },
        {
            "id": "rec_02",
            "name": "Meandro Central & Playas Doradas",
            "x": -2.5,
            "y": river_center_y(-2.5),
            "desc": "Correntada sobre bancos de arena, viento en los sauces y tero",
            "audio_type": "water_wind_tero"
        },
        {
            "id": "rec_03",
            "name": "Puente Histórico Alberdi",
            "x": 3.8,
            "y": river_center_y(3.8),
            "desc": "Paso del agua bajo los pilares históricos y golondrinas ribereñas",
            "audio_type": "bridge_swallows_water"
        },
        {
            "id": "rec_04",
            "name": "Parque Hipólito Yrigoyen (Villa Nueva)",
            "x": -1.2,
            "y": river_center_y(-1.2) - 1.2,
            "desc": "Espinal nativo, benteveo, calandrias y chicharras de la siesta",
            "audio_type": "park_cicadas_benteveo"
        },
        {
            "id": "rec_05",
            "name": "Bañados y Juncales (Ribera Sur)",
            "x": 7.2,
            "y": river_center_y(7.2) - 1.4,
            "desc": "Coro de sapitos y ranas criollas al anochecer con grillos de costa",
            "audio_type": "frogs_crickets_night"
        },
        {
            "id": "rec_06",
            "name": "Puente Negro & Bosque en Galería",
            "x": -6.5,
            "y": river_center_y(-6.5),
            "desc": "Cauce caudaloso, remolinos y rumor del monte ribereño",
            "audio_type": "deep_current_wind"
        }
    ]

    print("Creando balizas interactivas de registros sonoros...")
    for rec in field_recordings:
        bx = rec["x"]
        by = rec["y"]
        bz = elevation(bx, by) + 0.8
        
        # Geometría de baliza (cono invertido + esfera de pulso sonoro)
        b_mesh = bpy.data.meshes.new(f"Hito_{rec['id']}")
        bm_p = bmesh.new()
        
        # Cono apuntador
        cone = bmesh.ops.create_cone(bm_p, cap_ends=True, cap_tris=False, segments=8, radius1=0.22, radius2=0.02, depth=0.55)
        for v in cone['verts']:
            v.co.z += bz + 0.35
            v.co.x += bx
            v.co.y += by
            
        # Esfera flotante
        sph = bmesh.ops.create_icosphere(bm_p, subdivisions=2, radius=0.18)
        for v in sph['verts']:
            v.co.z += bz + 0.75
            v.co.x += bx
            v.co.y += by
            
        bm_p.to_mesh(b_mesh)
        bm_p.free()
        
        p_obj = bpy.data.objects.new(f"Beacon_{rec['id']}", b_mesh)
        p_obj.data.materials.append(mat_marker)
        # Guardar metadatos en custom properties de Blender
        p_obj["sound_id"] = rec["id"]
        p_obj["sound_name"] = rec["name"]
        p_obj["sound_desc"] = rec["desc"]
        p_obj["audio_type"] = rec["audio_type"]
        coll.objects.link(p_obj)

    # -------------------------------------------------------------
    # 7. ELEMENTOS CARTOGRÁFICOS QGIS: ROSA DE LOS VIENTOS Y MARCO
    # -------------------------------------------------------------
    print("Añadiendo rosa de los vientos y marco cartográfico...")
    # Rosa de los vientos (Flecha Norte 3D) en la esquina superior izquierda
    nav_mesh = bpy.data.meshes.new("GIS_Rosa_Vientos_North")
    bm_nav = bmesh.new()
    
    nx = x_min + 2.5
    ny = -y_min - 2.5
    nz = 3.6
    
    # Flecha Norte
    arrow = bmesh.ops.create_cone(bm_nav, cap_ends=True, cap_tris=False, segments=4, radius1=0.6, radius2=0.0, depth=1.6)
    for v in arrow['verts']:
        # Rotar para apuntar hacia el Norte (+Y)
        v.co.y += v.co.z
        v.co.z = 0
        v.co.x += nx
        v.co.y += ny
        v.co.z += nz
        
    bm_nav.to_mesh(nav_mesh)
    bm_nav.free()
    
    obj_nav = bpy.data.objects.new("GIS_Flecha_Norte", nav_mesh)
    obj_nav.data.materials.append(mat_marker)
    coll.objects.link(obj_nav)

    # -------------------------------------------------------------
    # 8. EXPORTACIÓN: .BLEND Y .GLB PARA LA WEB
    # -------------------------------------------------------------
    # Guardar en Blendertest y en la carpeta web
    out_dir_blendertest = r"C:\2025\IA\clases\Blendertest"
    out_dir_web = r"c:\2025\IA\codigo\clase2\ctalamochita-3d\public"

    os.makedirs(out_dir_blendertest, exist_ok=True)
    os.makedirs(out_dir_web, exist_ok=True)

    blend_file_path = os.path.join(out_dir_blendertest, "rio_ctalamochita_qgis.blend")
    glb_blendertest = os.path.join(out_dir_blendertest, "rio_ctalamochita_qgis.glb")
    glb_web = os.path.join(out_dir_web, "rio_ctalamochita_qgis.glb")

    print(f"Guardando proyecto Blender en: {blend_file_path}")
    bpy.ops.wm.save_as_mainfile(filepath=blend_file_path)

    print(f"Exportando modelo GLB para Web y Three.js...")
    # Exportación GLB optimizada
    bpy.ops.export_scene.gltf(
        filepath=glb_blendertest,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_attributes=True,
        export_all_vertex_colors=True,
        export_normals=True,
        export_extras=True # Exporta custom properties como sound_id, etc.
    )

    # Copiar o exportar directamente a la carpeta web
    import shutil
    shutil.copy2(glb_blendertest, glb_web)

    print(f"GLB generado exitosamente:")
    print(f"  -> {glb_blendertest}")
    print(f"  -> {glb_web}")
    print("=== MODELADO BLENDER FINALIZADO CON ÉXITO ===")

if __name__ == "__main__":
    main()
