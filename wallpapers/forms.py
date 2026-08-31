from django import forms
from .models import WallpaperProject, AestheticAsset


class WallpaperProjectForm(forms.ModelForm):
    class Meta:
        model = WallpaperProject
        fields = ['title', 'device_preset', 'layout_preset', 'custom_width', 'custom_height', 'thumbnail']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'w-full px-3 py-2 border rounded-xl'}),
            'custom_width': forms.NumberInput(attrs={'class': 'w-full px-3 py-2 border rounded-xl'}),
            'custom_height': forms.NumberInput(attrs={'class': 'w-full px-3 py-2 border rounded-xl'}),
        }


class AestheticAssetForm(forms.ModelForm):
    class Meta:
        model = AestheticAsset
        fields = ['title', 'category', 'image_url', 'image_file']
