import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import DevicePreset, LayoutPreset, WallpaperProject, AestheticAsset

# Fallback default presets for immediate out-of-the-box operation
DEFAULT_DEVICES = [
    {"id": "iphone-15-pro-max", "name": "iPhone 15/16 Pro Max", "width": 1290, "height": 2796, "category": "phone"},
    {"id": "samsung-s24-ultra", "name": "Samsung S24 Ultra", "width": 1440, "height": 3120, "category": "phone"},
    {"id": "macbook-pro-16", "name": "MacBook Pro 16\"", "width": 3456, "height": 2234, "category": "desktop"},
    {"id": "ipad-pro-129", "name": "iPad Pro 12.9\"", "width": 2048, "height": 2732, "category": "tablet"},
    {"id": "4k-uhd", "name": "4K UHD Desktop", "width": 3840, "height": 2160, "category": "desktop"},
]

DEFAULT_LAYOUTS = [
    {
        "id": "pinterest-dark-mosaic",
        "name": "Pinterest Dark Mosaic",
        "cols": 4, "rows": 6, "gap": 12, "padding": 16, "radius": 18,
        "bgColor": "#0b0f19", "heroRatio": "2x2",
        "description": "Dynamic multi-sized photo mosaic with 3 featured hero images on dark slate background.",
        "tag": "Trending", "is_popular": True,
    },
    {
        "id": "vintage-vinyl-wall",
        "name": "Vintage Gallery Wall",
        "cols": 3, "rows": 5, "gap": 18, "padding": 24, "radius": 12,
        "bgColor": "#1a1614", "heroRatio": "2x2",
        "description": "1 large centerpiece hero photo with warm analog tone & wide frame spacing.",
        "tag": "Classic Tone", "is_popular": False,
    },
    {
        "id": "minimal-studio-grid",
        "name": "Minimalist Studio Grid",
        "cols": 3, "rows": 6, "gap": 8, "padding": 12, "radius": 14,
        "bgColor": "#ffffff", "heroRatio": "1x1",
        "description": "Ultra-clean uniform equal grid with soft rounded corners on pure white canvas.",
        "tag": "Clean", "is_popular": False,
    },
    {
        "id": "dual-feature-vibrant",
        "name": "Dual Feature Showcase",
        "cols": 4, "rows": 6, "gap": 10, "padding": 14, "radius": 16,
        "bgColor": "#0f172a", "heroRatio": "2x2",
        "description": "Top & bottom dual featured hero images with vibrant pop tone color boost.",
        "tag": "Vibrant", "is_popular": False,
    },
    {
        "id": "monochrome-cinema-wall",
        "name": "Monochrome Cinema Wall",
        "cols": 4, "rows": 7, "gap": 8, "padding": 16, "radius": 8,
        "bgColor": "#000000", "heroRatio": "2x2",
        "description": "4 quad hero photos arranged in black-and-white cinematic film style.",
        "tag": "Noir", "is_popular": False,
    },
    {
        "id": "sunset-cream-collage",
        "name": "70s Sunset on Cream",
        "cols": 3, "rows": 5, "gap": 16, "padding": 20, "radius": 24,
        "bgColor": "#fdf6e2", "heroRatio": "2x2",
        "description": "Warm golden tones with 2 prominent hero images on warm cream canvas.",
        "tag": "Sunset", "is_popular": False,
    },
    {
        "id": "heart-magic-mosaic",
        "name": "Heart Romance Collage",
        "cols": 5, "rows": 7, "gap": 10, "padding": 14, "radius": 16,
        "bgColor": "#1a050d", "heroRatio": "2x2",
        "description": "Collage formed inside a heart silhouette with custom heart-clipped photo tiles.",
        "tag": "Heart Shape", "is_popular": False,
    },
    {
        "id": "unicorn-dream-wall",
        "name": "Unicorn Magical Wall",
        "cols": 5, "rows": 8, "gap": 8, "padding": 12, "radius": 14,
        "bgColor": "#0e0917", "heroRatio": "2x2",
        "description": "Magical unicorn silhouette collage with vivid pop colors and unicorn cutout tiles.",
        "tag": "Unicorn", "is_popular": False,
    },
    {
        "id": "starry-galaxy-grid",
        "name": "Star Galaxy Mosaic",
        "cols": 5, "rows": 7, "gap": 10, "padding": 14, "radius": 16,
        "bgColor": "#050811", "heroRatio": "2x2",
        "description": "5-pointed star silhouette collage on deep midnight cinema aesthetic background.",
        "tag": "Star Shape", "is_popular": False,
    },
]

GITHUB_REPO_URL = "https://github.com/imbhaumik147/vibewall"
GITHUB_PROFILE_URL = "https://github.com/imbhaumik147"


def home_view(request):
    """Render the landing page with interactive setup wizard and curated templates."""
    db_devices = list(DevicePreset.objects.all())
    db_layouts = list(LayoutPreset.objects.all())

    devices = [
        {"id": d.slug, "name": d.name, "width": d.width, "height": d.height, "category": d.category}
        for d in db_devices
    ] if db_devices else DEFAULT_DEVICES

    layouts = [
        {
            "id": l.slug, "name": l.name, "cols": l.cols, "rows": l.rows,
            "gap": l.gap, "padding": l.padding, "radius": l.radius,
            "bgColor": l.bg_color, "heroRatio": l.hero_ratio,
            "description": l.description, "tag": l.tag, "is_popular": l.is_popular
        }
        for l in db_layouts
    ] if db_layouts else DEFAULT_LAYOUTS

    context = {
        'devices': devices,
        'layouts': layouts,
        'github_repo_url': GITHUB_REPO_URL,
        'github_profile_url': GITHUB_PROFILE_URL,
        'active_page': 'home',
    }
    return render(request, 'wallpapers/index.html', context)


def studio_view(request):
    """Render the high-resolution interactive wallpaper creation workspace."""
    preset_slug = request.GET.get('preset', 'pinterest-dark-mosaic')
    device_slug = request.GET.get('device', 'iphone-15-pro-max')

    db_devices = list(DevicePreset.objects.all())
    db_layouts = list(LayoutPreset.objects.all())

    devices = [
        {"id": d.slug, "name": d.name, "width": d.width, "height": d.height, "category": d.category}
        for d in db_devices
    ] if db_devices else DEFAULT_DEVICES

    layouts = [
        {
            "id": l.slug, "name": l.name, "cols": l.cols, "rows": l.rows,
            "gap": l.gap, "padding": l.padding, "radius": l.radius,
            "bgColor": l.bg_color, "heroRatio": l.hero_ratio,
            "description": l.description, "tag": l.tag, "is_popular": l.is_popular
        }
        for l in db_layouts
    ] if db_layouts else DEFAULT_LAYOUTS

    context = {
        'initial_preset': preset_slug,
        'initial_device': device_slug,
        'devices': devices,
        'layouts': layouts,
        'github_repo_url': GITHUB_REPO_URL,
        'github_profile_url': GITHUB_PROFILE_URL,
        'active_page': 'studio',
    }
    return render(request, 'wallpapers/studio.html', context)


def about_view(request):
    """Render the About, Documentation, and Creator contact page."""
    context = {
        'github_repo_url': GITHUB_REPO_URL,
        'github_profile_url': GITHUB_PROFILE_URL,
        'active_page': 'about',
    }
    return render(request, 'wallpapers/about.html', context)


# ==============================================================================
# REST API Endpoints
# ==============================================================================

def api_presets(request):
    """Return JSON payload of all registered devices and layout templates."""
    db_devices = list(DevicePreset.objects.all())
    db_layouts = list(LayoutPreset.objects.all())

    devices = [
        {"id": d.slug, "name": d.name, "width": d.width, "height": d.height, "category": d.category}
        for d in db_devices
    ] if db_devices else DEFAULT_DEVICES

    layouts = [
        {
            "id": l.slug, "name": l.name, "cols": l.cols, "rows": l.rows,
            "gap": l.gap, "padding": l.padding, "radius": l.radius,
            "bgColor": l.bg_color, "heroRatio": l.hero_ratio,
            "description": l.description, "tag": l.tag, "is_popular": l.is_popular
        }
        for l in db_layouts
    ] if db_layouts else DEFAULT_LAYOUTS

    return JsonResponse({
        'status': 'success',
        'devices': devices,
        'layouts': layouts
    })


def api_starter_images(request):
    """Return list of curated aesthetic images."""
    assets = AestheticAsset.objects.all()
    if assets.exists():
        data = [{'title': a.title, 'category': a.category, 'url': a.url} for a in assets]
    else:
        # Fallback starter images
        data = [
            {"title": "Film Aesthetic 1", "category": "cinema", "url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80"},
            {"title": "Film Aesthetic 2", "category": "cinema", "url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80"},
            {"title": "Film Aesthetic 3", "category": "nature", "url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80"},
            {"title": "Film Aesthetic 4", "category": "neon", "url": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop&q=80"},
        ]
    return JsonResponse({'status': 'success', 'images': data})


@csrf_exempt
@require_http_methods(["POST"])
def api_save_project(request):
    """Save a wallpaper configuration to database."""
    try:
        data = json.loads(request.body.decode('utf-8'))
        title = data.get('title', 'Untitled Wallpaper')
        config = data.get('configuration', {})
        custom_w = data.get('width')
        custom_h = data.get('height')

        project = WallpaperProject.objects.create(
            title=title,
            custom_width=custom_w,
            custom_height=custom_h,
            configuration_json=config
        )
        return JsonResponse({
            'status': 'success',
            'project_id': project.id,
            'message': 'Project saved successfully'
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


def api_list_projects(request):
    """Return all saved projects."""
    projects = WallpaperProject.objects.all()[:50]
    data = [
        {
            'id': p.id,
            'title': p.title,
            'resolution': p.resolution_display,
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': p.updated_at.strftime('%Y-%m-%d %H:%M'),
        }
        for p in projects
    ]
    return JsonResponse({'status': 'success', 'projects': data})


def api_get_project(request, project_id):
    """Return single project configuration."""
    project = get_object_or_404(WallpaperProject, pk=project_id)
    return JsonResponse({
        'status': 'success',
        'project': {
            'id': project.id,
            'title': project.title,
            'resolution': project.resolution_display,
            'configuration': project.configuration_json,
            'created_at': project.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': project.updated_at.strftime('%Y-%m-%d %H:%M'),
        }
    })
