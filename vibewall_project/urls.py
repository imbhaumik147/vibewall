"""
URL configuration for vibewall_project.
"""

import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('wallpapers.urls')),
]

# Explicit static file handler for Serverless / Vercel
static_dir = os.path.join(settings.BASE_DIR, 'static')
urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': static_dir}),
]

if settings.DEBUG:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
