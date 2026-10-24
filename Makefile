.PHONY: up down logs keys

up: .env
	docker compose up -d
	@echo "Open http://localhost:3000"

.env:
	@printf "ELEVENLABS_API_KEY: "; read eleven; \
	printf "ELEVENLABS_AGENT_ID: "; read agent; \
	printf "GEMINI_API_KEY: "; read gemini; \
	printf "ELEVENLABS_API_KEY=%s\nELEVENLABS_AGENT_ID=%s\nGEMINI_API_KEY=%s\n" "$$eleven" "$$agent" "$$gemini" > .env

keys:
	rm -f .env
	$(MAKE) .env

down:
	docker compose down

logs:
	docker compose logs -f
