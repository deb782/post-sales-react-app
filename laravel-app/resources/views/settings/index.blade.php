@extends('layouts.app')
@section('title', 'Settings')
@section('heading', 'Settings')

@section('content')
    <div class="card p-6 max-w-2xl">
        <form method="POST" action="{{ route('settings.update') }}" enctype="multipart/form-data" class="space-y-4">
            @csrf @method('PUT')
            <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Company name</label>
                <input name="company_name" value="{{ $settings->company_name }}" class="input" required>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                    <input name="currency" value="{{ $settings->currency }}" class="input" required>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Expense threshold (₹)</label>
                    <input type="number" step="0.01" name="threshold_amount" value="{{ $settings->threshold_amount }}" class="input" required>
                    <p class="text-xs text-slate-500 mt-1">Amounts above this require Management final approval.</p>
                </div>
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Company logo</label>
                @if($settings->logo_path)
                    <img src="{{ Storage::disk('public')->url($settings->logo_path) }}" class="h-12 mb-2">
                @endif
                <input type="file" name="logo" accept="image/*" class="text-sm">
            </div>
            <div class="flex justify-end"><button class="btn-primary">Save settings</button></div>
        </form>
    </div>
@endsection
