
# Ledger Polls – Full Stack Setup

This project is a full stack application with:
- **Frontend:** React (Vite) with Phantom wallet login
- **Backend:** Node.js (Express) with Prisma ORM
- **Database:** PostgreSQL
- **Containerization:** Docker & Docker Compose

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) installed
- [Node.js](https://nodejs.org/) (for local development, optional)

## Project Structure

```
ledger-polls/
	backend/
	frontend/
	docker-compose.yml
```

## Running the Project

1. **Clone the repository and navigate to `ledger-polls` directory.**

2. **Build and start all services:**
	 ```sh
	 docker-compose up --build
	 ```

	 - This will start:
		 - PostgreSQL database
		 - Backend API (http://localhost:4000)
		 - Frontend React app (http://localhost:3000)

3. **(First time only) Set up the database schema:**
	 - Open a new terminal in the `ledger-polls` directory.
	 - Run the following command to apply Prisma migrations:
		 ```sh
		 docker-compose exec backend npx prisma migrate deploy
		 ```

4. **Access the app:**
	 - Frontend: [http://localhost:3000](http://localhost:3000)
	 - Backend API: [http://localhost:4000](http://localhost:4000)

## Development

- To develop frontend or backend separately, use the respective folders and run locally as needed.
- Update Prisma schema in `backend/prisma/schema.prisma` and run migrations as above.

## Notes

- All frontend code is in `frontend/`
- All backend code is in `backend/`
- Do not place `src/` or `public/` in the root directory.
