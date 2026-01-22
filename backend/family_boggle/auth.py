"""
Authentication and user management for Family Boggle.
Provides JWT-based authentication with SQLite database backend.
"""
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from pathlib import Path

import bcrypt
from jose import JWTError, jwt

from family_boggle.config import settings

# Database setup
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
    
    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verifies a JWT token and returns the payload if valid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


class UserManager:
    """Manages user authentication and account operations."""
    
    @staticmethod
    def register_user(username: str, password: str, email: Optional[str] = None) -> Tuple[bool, str]:
        """Registers a new user.
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Check if username already exists
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                return False, "Username already exists"
            
            # Check if email already exists (if provided)
            if email:
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    return False, "Email already registered"
            
            # Create user
            password_hash = hash_password(password)
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email, password_hash)
            )
            user_id = cursor.lastrowid
            
            # Create initial stats record
            cursor.execute(
                "INSERT INTO user_stats (user_id) VALUES (?)",
                (user_id,)
            )
            
            conn.commit()
            return True, "User registered successfully"
            
        except sqlite3.Error as e:
            conn.rollback()
            return False, f"Database error: {str(e)}"
        finally:
            conn.close()
    
    @staticmethod
    def authenticate_user(username: str, password: str) -> Tuple[Optional[dict], str]:
        """Authenticates a user.
        
        Returns:
            Tuple of (user_data: Optional[dict], message: str)
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, username, email, password_hash FROM users WHERE username = ?",
                (username,)
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
                (user_id,)
            )
            conn.commit()
            
            user_data = {
                "id": user_id,
                "username": username,
                "email": email
            }
            
            return user_data, "Authentication successful"
            
        except sqlite3.Error as e:
            return None, f"Database error: {str(e)}"
        finally:
            conn.close()
    
    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[dict]:
        """Gets user data by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, username, email, created_at, last_login FROM users WHERE id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            
            if not row:
                return None
            
            return {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "created_at": row["created_at"],
                "last_login": row["last_login"]
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
            cursor.execute("""
                UPDATE user_stats 
                SET total_games_played = total_games_played + 1,
                    total_score = total_score + ?,
                    total_wins = total_wins + ?,
                    total_challenges_completed = total_challenges_completed + ?,
                    best_score = MAX(best_score, ?)
                WHERE user_id = ?
            """, (score, 1 if is_winner else 0, challenges_completed, score, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
            
        except sqlite3.Error:
            conn.rollback()
            return False
        finally:
            conn.close()
    
    @staticmethod
    def get_user_stats(user_id: int) -> Optional[dict]:
        """Gets user statistics."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT u.username, u.email, u.created_at, u.last_login,
                       us.total_games_played, us.total_score, us.best_score,
                       us.total_wins, us.total_challenges_completed
                FROM users u
                JOIN user_stats us ON u.id = us.user_id
                WHERE u.id = ?
            """, (user_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            total_games = row["total_games_played"]
            win_rate = (
                round(row["total_wins"] / total_games * 100, 1)
                if total_games > 0 else 0
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
                    round(row["total_score"] / total_games, 1)
                    if total_games > 0 else 0
                )
            }
        finally:
            conn.close()
    
    @staticmethod  
    def link_ip_to_user(ip_address: str, user_id: int) -> bool:
        """Links an IP address to a user for anonymous play migration."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO ip_user_mappings (ip_address, user_id)
                VALUES (?, ?)
            """, (ip_address, user_id))
            
            conn.commit()
            return True
        except sqlite3.Error:
            conn.rollback()
            return False
        finally:
            conn.close()
    
    @staticmethod
    def get_user_by_ip(ip_address: str) -> Optional[int]:
        """Gets user ID associated with an IP address."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT user_id FROM ip_user_mappings WHERE ip_address = ? ORDER BY last_used DESC LIMIT 1",
                (ip_address,)
            )
            row = cursor.fetchone()
            return row["user_id"] if row else None
        finally:
            conn.close()


# Initialize database on module import
init_database()
user_manager = UserManager()