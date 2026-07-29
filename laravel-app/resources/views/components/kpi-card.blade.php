@props(['label', 'value', 'tone' => 'slate'])
@php
    $tones = [
        'slate' => 'text-slate-900',
        'green' => 'text-emerald-700',
        'amber' => 'text-amber-700',
        'red'   => 'text-red-700',
    ];
@endphp
<div class="card p-5">
    <div class="text-xs uppercase font-semibold text-slate-500">{{ $label }}</div>
    <div class="text-3xl font-semibold mt-2 {{ $tones[$tone] ?? '' }}">{{ $value }}</div>
</div>
