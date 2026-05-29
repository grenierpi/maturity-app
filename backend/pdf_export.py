"""
pdf_export.py — génération des rapports PDF avec pdfkit + Jinja2.
Prérequis : brew install wkhtmltopdf && pip install pdfkit
"""
import base64
import io
import math
import tempfile
from pathlib import Path
from jinja2 import Environment, FileSystemLoader


def _logo_data_uri() -> str:
    logo = Path(__file__).parent / "img_src" / "Invent_Logo_2COL_RGB.png"
    if logo.exists():
        return "data:image/png;base64," + base64.b64encode(logo.read_bytes()).decode()
    return ""


def radar_svg(labels, values_asis, values_tobe=None, size=280, max_val=4, color_asis="#C2C0B6", color_tobe="#7F77DD"):
    """Génère un SVG radar chart embarquable dans le HTML du PDF."""
    n = len(labels)
    if n == 0:
        return ""
    cx, cy = size / 2, size / 2
    r = size * 0.36

    def pt(i, val):
        angle = math.pi / 2 - 2 * math.pi * i / n
        rr = r * min(val or 0, max_val) / max_val
        return f"{cx + rr * math.cos(angle):.1f},{cy - rr * math.sin(angle):.1f}"

    # Grilles
    grids = ""
    for level in range(1, 5):
        pts = [pt(i, level) for i in range(n)]
        grids += f'<polygon points="{" ".join(pts)}" fill="none" stroke="#ECEAE2" stroke-width="0.5"/>'

    # Axes
    axes = "".join(
        f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{cx + r * math.cos(math.pi/2 - 2*math.pi*i/n):.1f}" y2="{cy - r * math.sin(math.pi/2 - 2*math.pi*i/n):.1f}" stroke="#ECEAE2" stroke-width="0.5"/>'
        for i in range(n)
    )

    # Polygone as-is
    pts_asis = " ".join(pt(i, v) for i, v in enumerate(values_asis))
    poly_asis = f'<polygon points="{pts_asis}" fill="{color_asis}" fill-opacity="0.25" stroke="{color_asis}" stroke-width="1.5"/>'

    # Polygone to-be (optionnel)
    poly_tobe = ""
    if values_tobe:
        pts_tobe = " ".join(pt(i, v) for i, v in enumerate(values_tobe))
        poly_tobe = f'<polygon points="{pts_tobe}" fill="{color_tobe}" fill-opacity="0.3" stroke="{color_tobe}" stroke-width="2"/>'

    # Labels
    label_els = ""
    for i, label in enumerate(labels):
        angle = math.pi / 2 - 2 * math.pi * i / n
        lr = r + 20
        lx = cx + lr * math.cos(angle)
        ly = cy - lr * math.sin(angle)
        anchor = "middle"
        if lx < cx - 10: anchor = "end"
        elif lx > cx + 10: anchor = "start"
        label_els += f'<text x="{lx:.1f}" y="{ly + 3:.1f}" text-anchor="{anchor}" font-size="8" fill="#888780" font-family="Arial">{str(label)[:14]}</text>'

    return f'''<svg width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">{grids}{axes}{poly_asis}{poly_tobe}{label_els}</svg>'''


def generate_pdf(synthesis: dict) -> bytes:
    return _render_pdf("report.html", synthesis)


def generate_roadmap_pdf(data: dict) -> bytes:
    return _render_pdf("report_roadmap.html", data)


def generate_sheets_pdf(data: dict) -> bytes:
    return _render_pdf("report_sheets.html", data)


def generate_gantt_pdf(data: dict) -> bytes:
    return _render_pdf("report_gantt.html", data, {"orientation": "Landscape"})


def generate_full_report_pdf(gantt_data: dict, sheets_data: dict) -> bytes:
    """Gantt (landscape) + fiches compactes (portrait) fusionnés en un seul PDF."""
    from pypdf import PdfWriter, PdfReader

    gantt_bytes  = generate_gantt_pdf(gantt_data)
    sheets_bytes = _render_pdf("report_sheets_compact.html", sheets_data)

    writer = PdfWriter()
    for raw in (gantt_bytes, sheets_bytes):
        reader = PdfReader(io.BytesIO(raw))
        for page in reader.pages:
            writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _render_pdf(template_name: str, context: dict, extra_options: dict = None) -> bytes:
    template_dir = Path(__file__).parent / "templates" / "pdf"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    env.globals["radar_svg"]     = radar_svg
    env.globals["logo_data_uri"] = _logo_data_uri()
    template = env.get_template(template_name)
    html_str = template.render(**context)

    try:
        import pdfkit
        options = {
            "page-size": "A4", "margin-top": "1.8cm", "margin-right": "2cm",
            "margin-bottom": "1.8cm", "margin-left": "2cm",
            "encoding": "UTF-8", "quiet": "",
        }
        if extra_options:
            options.update(extra_options)
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
            f.write(html_str)
            tmp_path = f.name
        pdf_bytes = pdfkit.from_file(tmp_path, False, options=options)
        Path(tmp_path).unlink(missing_ok=True)
        return pdf_bytes
    except ImportError:
        raise RuntimeError("pdfkit non installé — pip install pdfkit")
    except OSError as e:
        raise RuntimeError(f"wkhtmltopdf introuvable. Installez-le : https://wkhtmltopdf.org/downloads.html\nErreur : {e}")
