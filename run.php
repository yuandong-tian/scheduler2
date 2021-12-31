<?php
$html = file_get_contents('run.html');
echo $html;

$file = 'test.txt';
file_exists($file) or touch($file);
$var = array(
    "content" => file_get_contents($file) 
);
?>
<script>
var php_info = <?php echo json_encode($var); ?>; // Don't forget the extra semicolon!

function save_files() {
    var contentArea = document.querySelector('#cpp_content');
    var cpp_content = contentArea.value;
    var request = new XMLHttpRequest();
    request.open('POST', 'save_content.php', true);
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

    request.onload = function() {
        if (this.status >= 200 && this.status < 400) {
            console.log("Success");
            var resp = this.response;
        } else {
        alert ("Target server reached, but it returned an error" );
        }
    };
    request.onerror = function() {
      // There was a connection error of some sort
    };
    request.send("cpp_content=" + cpp_content);
}
</script>