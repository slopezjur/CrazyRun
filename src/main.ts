import './style.css';
import { createApplication } from './app/createApplication';

async function bootstrap(): Promise<void> {
    const application = createApplication(document, window);
    import.meta.hot?.dispose(() => application.dispose());
    try {
        await application.start();
    } catch (error) {
        application.dispose();
        throw error;
    }
}

void bootstrap().catch(error => {
    console.error('Failed to bootstrap game:', error);
    // The menu stays visible but inert once the application is disposed; explain why instead.
    document.getElementById('boot-error')?.removeAttribute('hidden');
});
