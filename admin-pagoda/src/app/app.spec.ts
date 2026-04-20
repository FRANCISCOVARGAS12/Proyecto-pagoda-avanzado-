import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.setItem('pagoda-auth', '1');
    localStorage.setItem('pagoda-user', 'Administrador');
    localStorage.setItem('pagoda-token', 'test-token');
    localStorage.setItem('pagoda-user-id', '1');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('pagoda-auth');
    localStorage.removeItem('pagoda-user');
    localStorage.removeItem('pagoda-token');
    localStorage.removeItem('pagoda-user-id');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Pagoda brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Pagoda');
  });
});
