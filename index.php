<?php require_once 'auth/auth_check.php'; ?>

<h1>Welcome <?php echo $_SESSION['name']; ?></h1>

<a href="auth/logout.php">Logout</a>
