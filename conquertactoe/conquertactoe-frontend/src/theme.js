import { createTheme } from '@material-ui/core/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
  overrides: {
    MuiButton: {
      root: {
        borderRadius: 20,
      },
    },
    MuiCard: {
      root: {
        borderRadius: 20,
      },
    },
  },
});

export default theme;
