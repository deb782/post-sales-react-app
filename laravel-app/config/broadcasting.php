<?php

return [

    'default' => env('BROADCAST_CONNECTION', 'null'),

    'connections' => [

        'null' => [
            'driver' => 'null',
        ],

        'log' => [
            'driver' => 'log',
        ],

    ],

];
