# 🌱 Plant-Care Hub

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

## 📝 About the Project

The **Plant-Care Hub** is a full-stack web application designed to help users efficiently manage and track the care routines for their plants. Built with **React** for a dynamic frontend and **Node.js with Express.js** for a robust backend, it allows users to securely register, log in, and maintain a personalized dashboard of their plants.

The application enables comprehensive CRUD (Create, Read, Update, Delete) operations for plant records, including details like watering and fertilizing frequencies. It also integrates with the **Trefle.io API** to provide detailed information about plant species, making it easier for users to identify and care for their greenery.

![Login](https://github.com/user-attachments/assets/1b6695e1-1f4c-456b-bcfd-000e903186ac)
![Suas Plantas](https://github.com/user-attachments/assets/af9620cf-911e-4247-97dc-8b1a65080f63)
![Adicionar Planta](https://github.com/user-attachments/assets/ee387d78-5b99-45c2-a7b8-5d48a5d15582)

## ✨ Features

The Plant-Care Hub offers a range of functionalities to simplify plant care:

* **Secure User Authentication:** Register and log in using email and password, secured with JSON Web Tokens (JWT).
* **Dashboard Overview:** View a personalized list of all your registered plants at a glance.
* **Plant Management (CRUD):**
    * **Add New Plants:** Input essential details like name, species, watering schedule, last watered date, fertilizing schedule, last fertilized date, and custom notes.
    * **Edit Plant Details:** Easily update any information for existing plants.
    * **Delete Plants:** Remove plants from your collection when no longer needed.
* **Trefle.io API Integration:** Search for plant species and retrieve detailed information from the Trefle.io database to enrich your plant records.
* **Intuitive User Interface:** A responsive and user-friendly frontend built with React for a smooth experience.
* **Notifications:** Real-time feedback and alerts using toast notifications for successful operations or errors.

## 💻 Technologies Used

**Backend:**

* **Node.js**: Server-side JavaScript runtime.
* **Express.js**: Fast, unopinionated, minimalist web framework for Node.js.
* **MongoDB**: NoSQL database for flexible data storage.
* **Mongoose**: MongoDB object data modeling (ODM) for Node.js.
* **Bcryptjs**: For secure password hashing.
* **JSON Web Token (JWT)**: For stateless user authentication.
* **Axios**: HTTP client for making requests to external APIs (Trefle.io).
* **Dotenv**: To manage environment variables securely.

**Frontend:**

* **React**: JavaScript library for building user interfaces.
* **React Router DOM**: For client-side routing within the application.
* **Axios**: HTTP client for making requests to the backend API.
* **React Toastify**: For customizable toast notifications.
* **HTML5, CSS3, JavaScript**: Core web technologies for structure, styling, and interactivity.

## 🚀 Getting Started

Follow these steps to set up and run the Plant-Care Hub on your local machine for development and testing.

### Prerequisites

Ensure you have the following installed:

* **Node.js** (includes npm): [Download & Install Node.js](https://nodejs.org/en/download/)
* **MongoDB**: [Install MongoDB Community Server](https://www.mongodb.com/try/download/community) or set up a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/indiaraelis/plant-care-hub.git](https://github.com/indiaraelis/plant-care-hub.git)
    cd plant-care-hub
    ```

2.  **Backend Setup:**
    Navigate to the `backend` directory, install dependencies, and configure environment variables.

    ```bash
    cd backend
    npm install
    ```

    Create a `.env` file in the `backend` directory with the following content:

    ```env
    PORT=5000
    MONGODB_URI=your_mongodb_connection_string
    JWT_SECRET=a_very_secret_key_for_jwt
    TREFLE_API_KEY=your_trefle_api_key
    ```
    *Replace `your_mongodb_connection_string` with your MongoDB URI (e.g., from MongoDB Atlas).*
    *Replace `a_very_secret_key_for_jwt` with a strong, random string.*
    *Replace `your_trefle_api_key` with your API key obtained from [Trefle.io](https://trefle.io/).*

3.  **Frontend Setup:**
    Navigate to the `frontend` directory and install dependencies.

    ```bash
    cd ../frontend
    npm install
    ```

    The frontend is configured to communicate with `http://localhost:5000` by default.

### Running the Application

1.  **Start the Backend Server:**
    From the `backend` directory:

    ```bash
    npm start
    ```
    The backend server will start on `http://localhost:5000`.

2.  **Start the Frontend Development Server:**
    From the `frontend` directory:

    ```bash
    npm start
    ```
    The React development server will start (typically on `http://localhost:3000`) and open the application in your default web browser.

You can now register a new account, log in, and begin managing your plants!

## API Endpoints

The backend provides the following RESTful API endpoints:

**Authentication:**

* `POST /api/auth/register` - Registers a new user.
* `POST /api/auth/login` - Authenticates a user and returns a JWT.

**Plants (requires JWT in `Authorization: Bearer <token>` header):**

* `GET /api/plants` - Retrieves all plants belonging to the authenticated user.
* `POST /api/plants` - Creates a new plant for the authenticated user.
* `GET /api/plants/:id` - Retrieves a specific plant by its ID.
* `PUT /api/plants/:id` - Updates an existing plant by its ID.
* `DELETE /api/plants/:id` - Deletes a plant by its ID.

**Trefle.io Integration (requires JWT in `Authorization: Bearer <token>` header):**

* `GET /api/trefle/search?query=plantName` - Searches for plant information using the Trefle.io API and returns results.

### Contributing

Contributions are welcome! If you have suggestions for features, improvements, or bug fixes, please feel free to open an issue or submit a pull request.

### License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/indiaraelis/plant-care-hub/blob/main/LICENSE) file for details.

### 👩‍💻 Author

Made with 💚 by **Indiara Elis**

Geotechnology specialist passionate about transforming data into decisions.
