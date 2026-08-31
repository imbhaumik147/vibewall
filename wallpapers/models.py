import json
from django.db import models


class DevicePreset(models.Model):
    CATEGORY_CHOICES = [
        ('phone', 'Phone'),
        ('tablet', 'Tablet'),
        ('desktop', 'Desktop / Laptop'),
        ('custom', 'Custom Dimensions'),
    ]

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='phone')
    width = models.PositiveIntegerField(help_text="Target pixel width (e.g. 1290)")
    height = models.PositiveIntegerField(help_text="Target pixel height (e.g. 2796)")
    icon = models.CharField(max_length=50, default='phone', help_text="Icon identifier (phone, tablet, desktop)")
    is_default = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = 'Device Preset'
        verbose_name_plural = 'Device Presets'

    def __str__(self):
        return f"{self.name} ({self.width}x{self.height})"


class LayoutPreset(models.Model):
    PATTERN_CHOICES = [
        ('mosaic', 'Dynamic Mosaic'),
        ('grid', 'Clean Uniform Grid'),
        ('shape', 'Shape Silhouette'),
        ('vintage', 'Vintage Gallery'),
        ('cinema', 'Cinematic Film'),
    ]

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    pattern_type = models.CharField(max_length=20, choices=PATTERN_CHOICES, default='mosaic')
    cols = models.PositiveIntegerField(default=4)
    rows = models.PositiveIntegerField(default=6)
    gap = models.PositiveIntegerField(default=12, help_text="Gap between photo tiles in px")
    padding = models.PositiveIntegerField(default=16, help_text="Canvas outer padding in px")
    radius = models.PositiveIntegerField(default=18, help_text="Border radius in px")
    bg_color = models.CharField(max_length=25, default='#0b0f19', help_text="Hex background color")
    hero_ratio = models.CharField(max_length=20, default='2x2', help_text="Hero tile dimensions (e.g. 2x2, 3x3)")
    filter_effect = models.CharField(max_length=50, blank=True, default='', help_text="CSS filter preset class")
    description = models.TextField(blank=True)
    tag = models.CharField(max_length=50, blank=True, default='', help_text="Card badge label")
    is_popular = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = 'Layout Preset'
        verbose_name_plural = 'Layout Presets'

    def __str__(self):
        return f"{self.name} ({self.cols}x{self.rows})"


class WallpaperProject(models.Model):
    title = models.CharField(max_length=200, default='Untitled Wallpaper')
    device_preset = models.ForeignKey(
        DevicePreset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects'
    )
    layout_preset = models.ForeignKey(
        LayoutPreset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects'
    )
    custom_width = models.PositiveIntegerField(null=True, blank=True)
    custom_height = models.PositiveIntegerField(null=True, blank=True)
    configuration_json = models.JSONField(
        default=dict,
        help_text="Full state JSON (slots, images, styles, heroes, shapes)"
    )
    thumbnail = models.ImageField(upload_to='thumbnails/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Wallpaper Project'
        verbose_name_plural = 'Wallpaper Projects'

    def __str__(self):
        return f"{self.title} - {self.updated_at.strftime('%Y-%m-%d %H:%M')}"

    @property
    def resolution_display(self):
        if self.device_preset:
            return f"{self.device_preset.width}x{self.device_preset.height}"
        if self.custom_width and self.custom_height:
            return f"{self.custom_width}x{self.custom_height}"
        return "Custom"


class AestheticAsset(models.Model):
    CATEGORY_CHOICES = [
        ('nature', 'Nature & Landscape'),
        ('anime', 'Anime & Illustration'),
        ('cinema', 'Cinema & Film Stills'),
        ('vintage', 'Vintage & Retro'),
        ('cyberpunk', 'Cyberpunk & Neon'),
        ('minimalist', 'Minimalist & Architecture'),
    ]

    title = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='nature')
    image_url = models.URLField(max_length=500, blank=True, help_text="External image CDN URL")
    image_file = models.ImageField(upload_to='assets/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'title']
        verbose_name = 'Aesthetic Asset'
        verbose_name_plural = 'Aesthetic Assets'

    def __str__(self):
        return f"[{self.category}] {self.title}"

    @property
    def url(self):
        if self.image_file:
            return self.image_file.url
        return self.image_url
