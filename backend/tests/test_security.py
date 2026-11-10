from petri_backend.security import hash_password, verify_password


def test_hash_password_round_trips():
    hashed = hash_password("correct-horse")
    assert hashed != "correct-horse"
    assert verify_password("correct-horse", hashed)
    assert not verify_password("wrong-password", hashed)


def test_hash_password_uses_distinct_salts():
    assert hash_password("same-password") != hash_password("same-password")
