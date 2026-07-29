<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function edit(): View
    {
        return view('settings.index', ['settings' => Setting::current()]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:120'],
            'currency' => ['required', 'string', 'max:8'],
            'threshold_amount' => ['required', 'numeric', 'min:0'],
            'logo' => ['nullable', 'image', 'max:2048'],
        ]);
        $settings = Setting::current();
        if ($request->hasFile('logo')) {
            $data['logo_path'] = $request->file('logo')->store('branding', 'public');
        }
        unset($data['logo']);
        $settings->update($data);
        return back()->with('status', 'Settings updated.');
    }
}
