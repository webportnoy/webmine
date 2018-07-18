<?php

ini_set('display_errors' , 0 );
error_reporting( 0 );

if( empty( $_POST ) ){
	exit;
}


$filename = "../highscores.json";
$scores = file_get_contents( $filename );
if( $scores ){
	$scores = json_decode( $scores, true );
}
else{
	$scores = array();
}

$new_score = array(
	'name' => preg_replace("/[^a-zA-Zа-яА-Я\-\_0-9]+/u", "", $_POST['name']),
	'novice' => intval( $_POST['novice'] ),
	'medium' => intval( $_POST['medium'] ),
	'profi' => intval( $_POST['profi'] )
);

for( $changed = false, $i = 0; $i < count( $scores ); $i++ ){
	if( $scores[$i]['name'] == $new_score['name'] ){
		$scores[$i]['novice'] = min( $scores[$i]['novice'], $new_score['novice'] );
		$scores[$i]['medium'] = min( $scores[$i]['medium'], $new_score['medium'] );
		$scores[$i]['profi'] = min( $scores[$i]['profi'], $new_score['profi'] );
		$changed = true;
		break;
	}
}

if( !$changed ){
	array_push( $scores, array(
		'name' => $new_score['name'],
		'novice' => $new_score['novice'],
		'medium' => $new_score['medium'],
		'profi' => $new_score['profi']
	) );
}

file_put_contents( $filename, json_encode( $scores ) );

?>