<?php
$filename = 'test.txt'; 
$cpp_content = $_POST['cpp_content'];

if(file_exists($filename)){
   file_put_contents($filename, $cpp_content);
}
?>