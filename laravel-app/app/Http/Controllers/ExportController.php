<?php

namespace App\Http\Controllers;

use App\Exports\ExpensesExport;
use App\Exports\PaymentsExport;
use App\Exports\StockExport;
use App\Exports\UnitsExport;
use App\Imports\UnitsImport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    public function unitsXlsx(Request $request)
    {
        return Excel::download(
            new UnitsExport($request->integer('project_id') ?: null, $request->get('status')),
            'units-'.now()->format('Ymd-His').'.xlsx',
        );
    }

    public function expensesXlsx(Request $request)
    {
        return Excel::download(
            new ExpensesExport($request->integer('project_id') ?: null),
            'expenses-'.now()->format('Ymd-His').'.xlsx',
        );
    }

    public function paymentsXlsx(Request $request)
    {
        return Excel::download(
            new PaymentsExport($request->integer('project_id') ?: null),
            'payments-'.now()->format('Ymd-His').'.xlsx',
        );
    }

    public function stockXlsx(Request $request)
    {
        return Excel::download(
            new StockExport($request->integer('project_id') ?: null),
            'stock-'.now()->format('Ymd-His').'.xlsx',
        );
    }

    public function unitsPdf(Request $request)
    {
        $units = (new UnitsExport(
            $request->integer('project_id') ?: null,
            $request->get('status'),
        ))->collection();
        $pdf = Pdf::loadView('exports.units-pdf', ['units' => $units])->setPaper('a4', 'landscape');
        return $pdf->download('units-'.now()->format('Ymd-His').'.pdf');
    }

    public function expensesPdf(Request $request)
    {
        $expenses = (new ExpensesExport($request->integer('project_id') ?: null))->collection();
        $pdf = Pdf::loadView('exports.expenses-pdf', ['expenses' => $expenses])->setPaper('a4', 'landscape');
        return $pdf->download('expenses-'.now()->format('Ymd-His').'.pdf');
    }

    public function importUnits(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'file' => ['required', 'file', 'mimes:xlsx,csv,xls', 'max:5120'],
        ]);
        $import = new UnitsImport((int) $data['project_id']);
        Excel::import($import, $request->file('file'));
        $errors = collect($import->errors())->map(fn($e) => $e->getMessage())->all();
        return back()->with('status',
            count($errors) === 0
                ? 'Units imported successfully.'
                : count($errors).' rows failed. Check spreadsheet formatting.');
    }
}
