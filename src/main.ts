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

void bootstrap().catch(error => console.error('Failed to bootstrap game:', error));
