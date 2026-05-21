import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.setItem('pagoda-auth', '1');
    localStorage.setItem('pagoda-user', 'Administrador');
    localStorage.setItem('pagoda-token', 'test-token');
    localStorage.setItem('pagoda-user-id', '1');
    localStorage.setItem('pagoda-role', 'ADMIN');
    sessionStorage.setItem('pagoda-superuser-token', 'test-superuser-token');
    sessionStorage.setItem('pagoda-superuser-expires', '2099-01-01T00:00:00.000Z');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('pagoda-auth');
    localStorage.removeItem('pagoda-user');
    localStorage.removeItem('pagoda-token');
    localStorage.removeItem('pagoda-user-id');
    localStorage.removeItem('pagoda-role');
    sessionStorage.removeItem('pagoda-superuser-token');
    sessionStorage.removeItem('pagoda-superuser-expires');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Pagoda brand', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Pagoda');
  });
});
