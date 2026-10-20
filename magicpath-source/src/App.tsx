import { Theme } from './settings/types';
import { LumaLanding11 } from './components/generated/LumaLanding11';

let theme: Theme = 'dark';

function App() {
  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setTheme(theme);

  return (
    <>
      <LumaLanding11 />
    </>
  ); // %EXPORT_STATEMENT%
}

export default App;
