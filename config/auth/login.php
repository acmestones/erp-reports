<?php
session_start();
require_once '../config/db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $login = $_POST['login'];
    $password = $_POST['password'];

    $stmt = $conn->prepare("SELECT id, full_name, password, role_id 
                            FROM users 
                            WHERE (mobile=? OR email=?) 
                            AND status='active'");
    $stmt->bind_param("ss", $login, $login);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($user = $result->fetch_assoc()) {

        if (password_verify($password, $user['password'])) {

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['name'] = $user['full_name'];
            $_SESSION['role_id'] = $user['role_id'];

            header("Location: ../index.php");
            exit;
        }
    }

    $error = "Invalid credentials";
}
?>

<form method="POST">
    <h2>Login</h2>
    <?php if(isset($error)) echo $error; ?>
    <input name="login" placeholder="Mobile or Email" required>
    <input name="password" type="password" placeholder="Password" required>
    <button type="submit">Login</button>
</form>
