# 🎨 VibeWall - Universal Aesthetic Collage & Wallpaper Creator

<p align="center">
  <img src="https://img.shields.io/badge/Django-5.x-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Canvas_API-Lossless_4K-4F46E5?style=for-the-badge&logo=html5&logoColor=white" alt="Canvas 4K" />
  <a href="https://github.com/imbhaumik147/vibewall"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repository" /></a>
</p>

---

## 🌟 Overview

**VibeWall** is a full-stack **Python Django** web application designed to create bespoke, high-resolution aesthetic wallpapers and photo collages tailored precisely to any screen resolution (iPhone 16/15 Pro Max, Samsung Galaxy S24 Ultra, MacBook Pro Retina, iPad Pro, and 4K Ultra HD displays).

Upload your photography, anime stills, movie posters, moodboards, or album covers to create fluid multi-size Pinterest-style mosaics, customizable Hero photo spans, vector cutout silhouettes (Heart, Unicorn, Star, Diamond, Butterfly, Hexagon), and export them in lossless HD/4K resolution.

🔗 **GitHub Repository:** [https://github.com/imbhaumik147/vibewall](https://github.com/imbhaumik147/vibewall)

---

## 🚀 Key Features

- **⚡ Full Python Django Backend**: Clean MVC architecture with Django URL dispatcher, modular views, ORM models, and template inheritance.
- **📱 Universal Device Dimensions**: Pre-configured aspect ratios for iPhones, Galaxy devices, iPads, MacBooks, 4K monitors, plus custom pixel entry.
- **🧩 Pinterest Dynamic Mosaic**: Smart algorithmic packing supporting multi-span photos, 1×2 vertical covers, and 2×1 horizontal spans.
- **⭐ Hero Photo Highlighting**: Scale hero images (2×2 to 5×5 Giant dimensions) with dedicated starring controls.
- **✨ Vector Clip Path Cutouts**: Custom CSS & Canvas vector shapes (Heart, Unicorn, 5-Point Star, Diamond, Hexagon, Butterfly, Rounded).
- **🎨 Live Aesthetics & Tone Filters**: Analog Vintage, Film Noir Monochrome, Vibrant Pop, 70s Sunset, and Cool Cinema presets.
- **🔄 Flexible Interaction Modes**: Choose between fluid Drag & Drop or Click & Swap interaction.
- **💾 REST API & Project Storage**: Backend endpoints to save wallpaper configurations, query device presets, and fetch aesthetic starter assets.
- **🖼️ Lossless Client-Side Rendering**: High-performance HTML5 Canvas rendering for full-resolution PNG / JPG export.

---

## 📁 Project Architecture

```
vibewall/
├── manage.py                          # Django CLI utility
├── requirements.txt                   # Project dependencies (Django, Pillow, WhiteNoise, etc.)
├── .gitignore                         # Git exclusion rules
├── README.md                          # Documentation and instructions
│
├── vibewall_project/                  # Django project root configuration
│   ├── __init__.py
│   ├── settings.py                    # Project settings (Static, Templates, Media, SQLite)
│   ├── urls.py                        # Root URL routing
│   ├── wsgi.py                        # WSGI production entrypoint
│   └── asgi.py                        # ASGI async entrypoint
│
├── wallpapers/                        # Main Django application
│   ├── __init__.py
│   ├── apps.py                        # WallpapersConfig
│   ├── models.py                      # DevicePreset, LayoutPreset, WallpaperProject, AestheticAsset
│   ├── admin.py                       # Django Admin configuration
│   ├── views.py                       # Page view controllers & JSON REST APIs
│   ├── urls.py                        # App URL routes ('/', '/studio/', '/about/', '/api/...')
│   ├── forms.py                       # Django forms for uploads and configurations
│   └── migrations/                    # Database migrations
│       ├── __init__.py
│       └── 0001_initial.py
│
├── templates/                         # Django HTML Templates
│   ├── base.html                      # Base template (navigation, Tailwind, footer)
│   └── wallpapers/
│       ├── index.html                 # Homepage with interactive setup wizard
│       ├── studio.html                # High-res interactive studio canvas
│       └── about.html                 # Documentation, features & creator profile
│
└── static/                            # Static Assets
    ├── css/
    │   └── style.css                  # Custom styling & glassmorphism themes
    └── js/
        ├── app.js                     # Main Studio UI controller & canvas exporter
        ├── grid.js                    # Dynamic Pinterest collage layout engine
        └── sample-data.js             # Device & layout preset catalog
```

---

## 🛠️ Django Routes & REST API Endpoints

### Web Pages
| URL Path | View Function | Description |
| :--- | :--- | :--- |
| `/` | `views.home_view` | Homepage & 3-step setup wizard |
| `/studio/` | `views.studio_view` | Wallpaper Creator Studio workspace |
| `/about/` | `views.about_view` | Features, Documentation & Contact |
| `/admin/` | `admin.site.urls` | Django Administrative dashboard |

### REST API Endpoints
| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/presets/` | Returns JSON catalog of device resolutions and layout presets |
| `GET` | `/api/starter-images/` | Returns curated aesthetic starter photos |
| `POST` | `/api/projects/save/` | Saves a wallpaper project configuration to the database |
| `GET` | `/api/projects/` | Lists recently saved wallpaper projects |
| `GET` | `/api/projects/<id>/` | Retrieves single wallpaper project state by ID |

---

## 💻 Installation & Quickstart Guide

### Prerequisites
Make sure Python 3.10+ and Git are installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/imbhaumik147/vibewall.git
cd vibewall
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Apply Database Migrations
```bash
python manage.py migrate
```

### 5. Create an Admin Superuser (Optional)
```bash
python manage.py createsuperuser
```

### 6. Run the Development Server
```bash
python manage.py runserver
```

Open your browser and navigate to **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

---

## 📤 Pushing Changes to GitHub

To link this codebase to the remote repository and push your commits:

```bash
# Initialize Git repository (if not already initialized)
git init

# Add all files
git add .

# Create initial commit
git commit -m "feat: Convert VibeWall to full-stack Python Django project"

# Rename default branch to main
git branch -M main

# Link remote GitHub repository
git remote add origin https://github.com/imbhaumik147/vibewall.git

# Push to GitHub
git push -u origin main
```

---

## 👨‍💻 Developer & Author

- **Developer:** Bhaumik
- **GitHub:** [@imbhaumik147](https://github.com/imbhaumik147)
- **Repository:** [imbhaumik147/vibewall](https://github.com/imbhaumik147/vibewall)
- **Instagram:** [@imbhaumik__](https://www.instagram.com/imbhaumik__)
- **X / Twitter:** [@imbhaumik_](https://x.com/imbhaumik_)
- **Email:** [imbhaumik168@gmail.com](mailto:imbhaumik168@gmail.com)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
