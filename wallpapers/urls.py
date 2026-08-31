from django.urls import path
from . import views

urlpatterns = [
    # Pages
    path('', views.home_view, name='home'),
    path('studio/', views.studio_view, name='studio'),
    path('about/', views.about_view, name='about'),

    # REST APIs
    path('api/presets/', views.api_presets, name='api_presets'),
    path('api/starter-images/', views.api_starter_images, name='api_starter_images'),
    path('api/projects/save/', views.api_save_project, name='api_save_project'),
    path('api/projects/', views.api_list_projects, name='api_list_projects'),
    path('api/projects/<int:project_id>/', views.api_get_project, name='api_get_project'),
]
