"""Build one model, export both formats, reopen both, save editable source."""
import json
from pathlib import Path

import numpy as np

import mesh_engine as me


def build_files(path, spec):
    import cad_engine
    from cad_quality import prepare_model,check_constraints,dimension_sheet
    original_spec=spec
    spec,quality=prepare_model(spec)
    path = Path(path)
    node = spec.get('tree', spec) if isinstance(spec, dict) else None
    notes = []
    allow_multiple = bool(spec.get('allow_multiple', False)) if isinstance(spec, dict) else False
    if isinstance(node, dict) and node.get('shape') in ('mesh','loft','sculpt','human') and node.get('op','') in ('','add') and not any(k in node for k in ('position','rotation','scale')):
        mesh = me.build_shape(node).grounded()
        info = mesh.validate(connected=not allow_multiple)
        solid = None
    else:
        if not cad_engine.AVAILABLE:
            raise ValueError('The Manifold CAD dependency is missing; install requirements.txt. CAD cannot safely fall back to overlapping triangles.')
        solid, notes, _ = cad_engine.build_program(spec)
        mesh = me.Mesh(*cad_engine.mesh_arrays(solid)).grounded()
        info = mesh.validate(connected=not allow_multiple)
    info=check_constraints(spec,mesh,info);info['quality']=quality
    render_color=spec.get('material',{}).get('color')
    if isinstance(render_color,str):
        value=render_color.lstrip('#');render_color=[int(value[i:i+2],16) for i in (0,2,4)]
    elif render_color is not None:render_color=[v*255 for v in render_color]
    info['render_color']=render_color
    if any(n.startswith('⚠️') for n in notes):
        raise ValueError('; '.join(n for n in notes if n.startswith('⚠️')))
    if isinstance(node, dict) and node.get('shape') == 'human':
        notes.append('ℹ️ This is a procedural human figurine, not a scan or an anatomically certified model.')
    stl, glb = path.with_suffix('.stl'), path.with_suffix('.glb')
    me.write_stl(stl, mesh)
    me.write_glb(glb, mesh,spec.get('material'))
    stl_check = me.read_stl(stl).validate(connected=not allow_multiple)
    glb_check = me.read_glb(glb).validate(connected=not allow_multiple)
    if not np.allclose(stl_check['size_mm'], glb_check['size_mm'], rtol=1e-5, atol=1e-4):
        raise ValueError('Export sizes differ between STL and GLB')
    source = path.with_suffix('.model.json')
    source.write_text(json.dumps(original_spec, indent=2, ensure_ascii=False), encoding='utf-8')
    info.update({'exports':{stl.name:stl_check, glb.name:glb_check},
                 'units':{'stl':'millimetres','glb':'metres (Y up)'},
                 'source':source.name, 'visual_review':'not performed by geometry validation'})
    assembly=spec.get('assembly',{}) if isinstance(spec,dict) else {}
    if assembly.get('export_individual_parts'):
        import zipfile
        labels=assembly.get('parts',[])
        children=spec.get('tree',{}).get('children',[])
        if len(labels)!=len(children) or len(labels)>20:raise ValueError('Assembly part labels must match the component nodes')
        parts_dir=path.with_name(path.stem+'-parts');parts_dir.mkdir()
        exported=[]
        for index,(label,child) in enumerate(zip(labels,children)):
            rotations=assembly.get('print_rotations',[])
            rotation=rotations[index] if index<len(rotations) else [90,0,0] if index<2 else [0,90,0] if index<4 else [0,0,0]
            part_solid,_,_=cad_engine.build_program({'tree':{'op':'union','children':[child],'rotation':rotation}})
            part=me.Mesh(*cad_engine.mesh_arrays(part_solid)).grounded();part_info=part.validate()
            stem=''.join(c if c.isalnum() else '-' for c in str(label)).strip('-') or f'part-{index+1}'
            part_stl=parts_dir/(stem+'.stl');part_glb=parts_dir/(stem+'.glb')
            me.write_stl(part_stl,part);me.write_glb(part_glb,part)
            me.read_stl(part_stl).validate();me.read_glb(part_glb).validate()
            exported.append({'name':label,'stl':part_stl.relative_to(path.parent).as_posix(),'glb':part_glb.relative_to(path.parent).as_posix(),'size_mm':part_info['size_mm'],'volume_mm3':part_info['volume_mm3'],'print_rotation':rotation})
        archive=path.with_name(path.stem+'-parts.zip')
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
            for file in parts_dir.iterdir():bundle.write(file,file.name)
        import csv
        bom=path.with_name(path.stem+'-parts.csv')
        with bom.open('w',newline='',encoding='utf-8-sig') as handle:
            writer=csv.writer(handle);writer.writerow(['Part','Quantity','Width (mm)','Depth (mm)','Height (mm)','Volume (cm3)','STL'])
            for part in exported:writer.writerow([part['name'],1,*[round(v,3) for v in part['size_mm']],round(part['volume_mm3']/1000,3),part['stl']])
        info['assembly_parts']=exported;info['parts_archive']=archive.name;info['bill_of_materials']=bom.name
        notes.append(f'Individual assembly panels exported to {archive.name}; each panel is laid flat for inspection/printing.')
    drawing=path.with_name(path.stem+'-dimensions.svg')
    dimension_sheet(drawing,mesh,info);info['dimension_sheet']=drawing.name
    path.with_name(path.stem+'-validation.json').write_text(json.dumps(info, indent=2), encoding='utf-8')
    try:
        # Reuse the existing CPU rasterizer; no OpenGL/GPU is required on Render.
        from PIL import Image, ImageDraw
        v, f = mesh.vertices, mesh.faces
        width, height = 960, 560
        sheet = Image.new('RGB', (width,height), (20,22,30))
        for label, yaw, pitch, x, y, w, h in (
            ('ISOMETRIC',-35,20,0,0,640,560),('FRONT',0,0,640,0,320,186),
            ('RIGHT',-90,0,640,186,320,186),('TOP',0,90,640,372,320,188)):
            view = cad_engine._render_view(v, f, yaw, pitch, w, h, ss=1, ground=False,color=render_color)
            sheet.paste(view,(x,y))
            ImageDraw.Draw(sheet).text((x+10,y+8), label, fill=(180,190,210))
        sheet.save(path.with_name(path.stem+'-preview.png'))
    except Exception as error:
        notes.append(f'ℹ️ Preview unavailable ({type(error).__name__}); use the interactive 3D view.')
    notes.append(f"ℹ️ Mesh verified: {info['triangles']:,} triangles, {info['components']} shell(s), closed edges, consistent face winding and positive volume. STL and GLB reopened and checked.")
    notes.append('ℹ️ Local wall thickness, supports, self intersections, and resemblance still need review; see the validation report.')
    return notes
