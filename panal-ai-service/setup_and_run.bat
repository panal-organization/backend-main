@echo off
REM Espera a que Python 3.12 esté listo
timeout /t 5 /nobreak

REM Crea venv con Python 3.12
python.exe -m venv .venv

REM Activa el venv
call .\.venv\Scripts\activate.bat

REM Instala dependencias
pip install -r requirements.txt

REM Arranca uvicorn
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
