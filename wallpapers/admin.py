from django.contrib import admin
from .models import DevicePreset, LayoutPreset, WallpaperProject, AestheticAsset


@admin.register(DevicePreset)
class DevicePresetAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'width', 'height', 'is_default', 'display_order')
    list_filter = ('category', 'is_default')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ('display_order', 'is_default')


@admin.register(LayoutPreset)
class LayoutPresetAdmin(admin.ModelAdmin):
    list_display = ('name', 'pattern_type', 'cols', 'rows', 'hero_ratio', 'is_popular', 'display_order')
    list_filter = ('pattern_type', 'is_popular')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ('display_order', 'is_popular')


@admin.register(WallpaperProject)
class WallpaperProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'device_preset', 'layout_preset', 'resolution_display', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at', 'device_preset')
    search_fields = ('title',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AestheticAsset)
class AestheticAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at')
    list_filter = ('category',)
    search_fields = ('title',)
