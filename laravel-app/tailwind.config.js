/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './resources/**/*.blade.php',
        './resources/**/*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    50:  '#f5f7fb',
                    100: '#e8edf7',
                    500: '#3d5afe',
                    600: '#2f47d1',
                    700: '#2337a3',
                    900: '#141e5a',
                },
            },
        },
    },
    plugins: [require('@tailwindcss/forms')],
};
