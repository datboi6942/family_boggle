"""
Authentication and user management for Family Boggle.
Provides JWT-based authentication with SQLite database backend.
"""

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from jose import JWTError, jwt

from family_boggle.config import settings

# Database setup
# Parse DATABASE_URL (e.g., "sqlite:///./family_boggle.db")
if settings.DATABASE_URL.startswith("sqlite:///"):
    # Remove "sqlite:///" prefix and handle relative paths
    db_relative_path = settings.DATABASE_URL.replace("sqlite:///", "")
    DB_PATH = Path(db_relative_path)
    # If path is relative, resolve against project root
    if not DB_PATH.is_absolute():
        DB_PATH = Path(__file__).parent.parent / DB_PATH
else:
    # Fallback for other database URLs or development
    DB_PATH = Path(__file__).parent.parent / "family_boggle.db"


def get_db_connection():
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
    return conn


def init_database():
    """Initializes the database with required tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    """)

    # User stats table (linked to users)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id INTEGER PRIMARY KEY,
            total_games_played INTEGER DEFAULT 0,
            total_score INTEGER DEFAULT 0,
            best_score INTEGER DEFAULT 0,
            total_wins INTEGER DEFAULT 0,
            total_challenges_completed INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # IP to user mapping for linking anonymous play to accounts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ip_user_mappings (
            ip_address TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (ip_address, user_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # Friend requests table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, rejected
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(sender_id, receiver_id)
        )
    """)

    # Friends table (accepted friendships)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS friends (
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user1_id, user2_id),
            FOREIGN KEY (user1_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (user2_id) REFERENCES users (id) ON DELETE CASCADE,
            CHECK (user1_id < user2_id)  -- Ensure unique pairing
        )
    """)

    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> dict | None:
    """Verifies a JWT token and returns the payload if valid."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


class UserManager:
    """Manages user authentication and account operations."""

    @staticmethod
    def register_user(
        username: str, password: str, email: str | None = None
    ) -> tuple[bool, str]:
        """Registers a new user.

        Returns:
            Tuple of (success: bool, message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Create user - rely on database UNIQUE constraints for username and email
            password_hash = hash_password(password)
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email, password_hash),
            )
            user_id = cursor.lastrowid

            # Create initial stats record
            cursor.execute("INSERT INTO user_stats (user_id) VALUES (?)", (user_id,))

            conn.commit()
            return True, "User registered successfully"

        except sqlite3.IntegrityError as e:
            conn.rollback()
            error_msg = str(e).lower()
            if "username" in error_msg:
                return False, "Username already exists"
            elif "email" in error_msg:
                return False, "Email already registered"
            else:
                return False, f"Database constraint error: {str(e)}"
        except sqlite3.Error as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        finally:
            conn.close()

    @staticmethod
    def authenticate_user(username: str, password: str) -> tuple[dict | None, str]:
        """Authenticates a user.

        Returns:
            Tuple of (user_data: Optional[dict], message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT id, username, email, password_hash "
                "FROM users WHERE username = ?",
                (username,),
            )
            user_row = cursor.fetchone()

            if not user_row:
                return None, "Invalid username or password"

            user_id, username, email, password_hash = user_row

            if not verify_password(password, password_hash):
                return None, "Invalid username or password"

            # Update last login
            cursor.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
                (user_id,),
            )
            conn.commit()

            user_data = {"id": user_id, "username": username, "email": email}

            return user_data, "Authentication successful"

        except sqlite3.Error as e:
            return None, f"Database error: {str(e)}"
        finally:
            conn.close()

    @staticmethod
    def get_user_by_id(user_id: int) -> dict | None:
        """Gets user data by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT id, username, email, created_at, last_login "
                "FROM users WHERE id = ?",
                (user_id,),
            )
            row = cursor.fetchone()

            if not row:
                return None

            return {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "created_at": row["created_at"],
                "last_login": row["last_login"],
            }
        finally:
            conn.close()

    @staticmethod
    def update_user_stats(user_id: int, game_data: dict) -> bool:
        """Updates user statistics after a game.

        Args:
            user_id: The user ID
            game_data: Dictionary with keys:
                - score: Game score
                - is_winner: Whether user won
                - challenges_completed: Number of challenges completed

        Returns:
            True if successful, False otherwise
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            score = game_data.get("score", 0)
            is_winner = game_data.get("is_winner", False)
            challenges_completed = game_data.get("challenges_completed", 0)

            # Update stats
            cursor.execute(
                """
                UPDATE user_stats 
                SET total_games_played = total_games_played + 1,
                    total_score = total_score + ?,
                    total_wins = total_wins + ?,
                    total_challenges_completed = total_challenges_completed + ?,
                    best_score = MAX(best_score, ?)
                WHERE user_id = ?
            """,
                (score, 1 if is_winner else 0, challenges_completed, score, user_id),
            )

            conn.commit()
            return cursor.rowcount > 0

        except sqlite3.Error:
            conn.rollback()
            return False
        finally:
            conn.close()

    @staticmethod
    def get_user_stats(user_id: int) -> dict | None:
        """Gets user statistics."""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                SELECT u.username, u.email, u.created_at, u.last_login,
                       us.total_games_played, us.total_score, us.best_score,
                       us.total_wins, us.total_challenges_completed
                FROM users u
                JOIN user_stats us ON u.id = us.user_id
                WHERE u.id = ?
            """,
                (user_id,),
            )

            row = cursor.fetchone()
            if not row:
                return None

            total_games = row["total_games_played"]
            win_rate = (
                round(row["total_wins"] / total_games * 100, 1)
                if total_games > 0
                else 0
            )

            return {
                "username": row["username"],
                "email": row["email"],
                "created_at": row["created_at"],
                "last_login": row["last_login"],
                "total_games_played": total_games,
                "total_score": row["total_score"],
                "best_score": row["best_score"],
                "total_wins": row["total_wins"],
                "total_challenges_completed": row["total_challenges_completed"],
                "win_rate": win_rate,
                "avg_score": (
                    round(row["total_score"] / total_games, 1) if total_games > 0 else 0
                ),
            }
        finally:
            conn.close()

    @staticmethod
    def link_ip_to_user(ip_address: str, user_id: int) -> bool:
        """Links an IP address to a user for anonymous play migration.

        Note: Uses INSERT OR REPLACE with composite primary key (ip_address, user_id).
        This allows multiple users per IP (family sharing devices) and updates
        timestamps for existing mappings.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                INSERT OR REPLACE INTO ip_user_mappings (ip_address, user_id)
                VALUES (?, ?)
            """,
                (ip_address, user_id),
            )

            conn.commit()
            return True
        except sqlite3.Error:
            conn.rollback()
            return False
        finally:
            conn.close()

    @staticmethod
    def get_user_by_ip(ip_address: str) -> int | None:
        """Gets user ID associated with an IP address."""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT user_id FROM ip_user_mappings WHERE ip_address = ? "
                "ORDER BY last_used DESC LIMIT 1",
                (ip_address,),
            )
            row = cursor.fetchone()
            return row["user_id"] if row else None
        finally:
            conn.close()

    # Friend management methods
    @staticmethod
    def send_friend_request(sender_id: int, receiver_username: str) -> tuple[bool, str]:
        """Sends a friend request to another user by username.

        Returns:
            Tuple of (success: bool, message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Get receiver user ID
            cursor.execute(
                "SELECT id FROM users WHERE username = ?", (receiver_username,)
            )
            receiver_row = cursor.fetchone()
            if not receiver_row:
                return False, "User not found"
            receiver_id = receiver_row["id"]

            # Check if sender and receiver are the same
            if sender_id == receiver_id:
                return False, "Cannot send friend request to yourself"

            # Check if friend request already exists in either direction
            cursor.execute(
                "SELECT id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = 'pending'",
                (sender_id, receiver_id, receiver_id, sender_id),
            )
            if cursor.fetchone():
                return False, "Friend request already sent"

            # Check if they are already friends
            cursor.execute(
                "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
                (sender_id, receiver_id, receiver_id, sender_id),
            )
            if cursor.fetchone():
                return False, "Already friends"

            # Create friend request
            cursor.execute(
                "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')",
                (sender_id, receiver_id),
            )
            conn.commit()
            return True, "Friend request sent"
        except sqlite3.IntegrityError as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        except sqlite3.Error as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        finally:
            conn.close()

    @staticmethod
    def get_friend_requests(user_id: int, status: str = "pending") -> list[dict]:
        """Gets friend requests for a user (received pending requests by default).

        Args:
            user_id: The user ID
            status: Request status to filter by (pending, accepted, rejected)

        Returns:
            List of friend request dictionaries
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                SELECT fr.*, 
                       sender.username as sender_username,
                       receiver.username as receiver_username
                FROM friend_requests fr
                JOIN users sender ON fr.sender_id = sender.id
                JOIN users receiver ON fr.receiver_id = receiver.id
                WHERE (fr.receiver_id = ? OR fr.sender_id = ?) AND fr.status = ?
                ORDER BY fr.created_at DESC
            """,
                (user_id, user_id, status),
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    @staticmethod
    def respond_to_friend_request(
        request_id: int, user_id: int, action: str
    ) -> tuple[bool, str]:
        """Responds to a friend request (accept or reject).

        Args:
            request_id: The friend request ID
            user_id: The user ID (must be the receiver)
            action: 'accept' or 'reject'

        Returns:
            Tuple of (success: bool, message: str)
        """
        if action not in ["accept", "reject"]:
            return False, "Invalid action. Must be 'accept' or 'reject'"

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Verify request exists and user is the receiver
            cursor.execute(
                "SELECT sender_id, receiver_id FROM friend_requests WHERE id = ? AND status = 'pending'",
                (request_id,),
            )
            request_row = cursor.fetchone()
            if not request_row:
                return False, "Friend request not found or already processed"

            if request_row["receiver_id"] != user_id:
                return False, "Not authorized to respond to this request"

            sender_id = request_row["sender_id"]
            receiver_id = request_row["receiver_id"]

            if action == "accept":
                # Update request status
                cursor.execute(
                    "UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (request_id,),
                )
                # Add to friends table (ensure user1_id < user2_id)
                user1_id = min(sender_id, receiver_id)
                user2_id = max(sender_id, receiver_id)
                cursor.execute(
                    "INSERT OR IGNORE INTO friends (user1_id, user2_id) VALUES (?, ?)",
                    (user1_id, user2_id),
                )
                message = "Friend request accepted"
            else:  # reject
                cursor.execute(
                    "DELETE FROM friend_requests WHERE id = ?", (request_id,)
                )
                message = "Friend request rejected"

            conn.commit()
            return True, message
        except sqlite3.Error as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        finally:
            conn.close()

    @staticmethod
    def get_friends(user_id: int) -> list[dict]:
        """Gets a user's friends list.

        Returns:
            List of friend dictionaries with user details
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                SELECT u.id, u.username, u.created_at, f.created_at as friends_since
                FROM friends f
                JOIN users u ON (
                    (f.user1_id = ? AND u.id = f.user2_id) OR
                    (f.user2_id = ? AND u.id = f.user1_id)
                )
                ORDER BY u.username
            """,
                (user_id, user_id),
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    @staticmethod
    def remove_friend(user_id: int, friend_id: int) -> tuple[bool, str]:
        """Removes a friend relationship.

        Args:
            user_id: The user ID
            friend_id: The friend's user ID to remove

        Returns:
            Tuple of (success: bool, message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Verify friendship exists
            cursor.execute(
                """
                SELECT * FROM friends 
                WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
            """,
                (user_id, friend_id, friend_id, user_id),
            )
            if not cursor.fetchone():
                return False, "Not friends with this user"

            # Delete from friends table (order doesn't matter due to check constraint)
            user1_id = min(user_id, friend_id)
            user2_id = max(user_id, friend_id)
            cursor.execute(
                "DELETE FROM friends WHERE user1_id = ? AND user2_id = ?",
                (user1_id, user2_id),
            )

            # Also delete any friend requests between them
            cursor.execute(
                "DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
                (user_id, friend_id, friend_id, user_id),
            )

            conn.commit()
            return True, "Friend removed"
        except sqlite3.Error as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        finally:
            conn.close()


# Initialize database on module import
init_database()
user_manager = UserManager()
