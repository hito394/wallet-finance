PYTHON ?= python3

install:
	$(PYTHON) -m pip install -r requirements.txt

bootstrap:
	$(PYTHON) -m app.db.bootstrap

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

lint:
	$(PYTHON) -m compileall app
