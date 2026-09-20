import unittest
from datetime import timedelta
from jose import jwt
from services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
)


class TestAuthUnit(unittest.TestCase):
    def test_password_hashing_and_verification(self):
        raw_password = "SecurePassword123!"
        hashed = hash_password(raw_password)

        self.assertNotEqual(hashed, raw_password)
        self.assertTrue(verify_password(raw_password, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_create_and_decode_access_token(self):
        payload = {"sub": "testuser@example.com"}
        token = create_access_token(payload, expires_delta=timedelta(minutes=15))

        self.assertIsInstance(token, str)
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        self.assertEqual(decoded.get("sub"), "testuser@example.com")
        self.assertIn("exp", decoded)

    def test_token_expiration(self):
        payload = {"sub": "expired@example.com"}
        # expired 10 seconds ago
        token = create_access_token(payload, expires_delta=timedelta(seconds=-10))

        with self.assertRaises(jwt.ExpiredSignatureError):
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


if __name__ == "__main__":
    unittest.main()
