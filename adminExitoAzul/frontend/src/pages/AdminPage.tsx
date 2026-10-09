import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import {useAuth} from '../auth/useAuth';
import {
  fetchAdminPaymentsUsers,
  fetchAdminUserCatalog,
  fetchAdminUserEmails,
} from '../features/admin/admin.service';
import type {
  AdminCatalogImage,
  AdminPaymentUser,
  AdminUserCatalog,
  AdminUserEmail,
} from '../features/admin/admin.types';

const ADMIN_EMAIL = 'artbenitezdev@gmail.com';
const PAYMENTS_PAGE_SIZE = 10;

type AdminTab = 'usuarios' | 'pagos';

const normalizeEmail = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

const formatIsoDate = (value: string | null): string => {
  if (!value) {
    return 'Sin dato';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sin dato';
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
};

function AdminPage() {
  const {user} = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('usuarios');
  const [adminUsers, setAdminUsers] = useState<AdminUserEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [userCatalog, setUserCatalog] = useState<AdminUserCatalog | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<AdminCatalogImage | null>(null);
  const [usersFeedback, setUsersFeedback] = useState<string>('');
  const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [paymentUsers, setPaymentUsers] = useState<AdminPaymentUser[]>([]);
  const [paymentsNextPageToken, setPaymentsNextPageToken] = useState<string | null>(null);
  const [paymentsFeedback, setPaymentsFeedback] = useState<string>('');
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [isLoadingMorePayments, setIsLoadingMorePayments] = useState<boolean>(false);
  const isAdminUser = normalizeEmail(user?.email) === ADMIN_EMAIL;

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setExpandedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedImage]);

  useEffect(() => {
    if (!isAdminUser) {
      return;
    }

    let isMounted = true;
    setIsLoadingEmails(true);
    setUsersFeedback('');

    void fetchAdminUserEmails()
      .then((nextUsers) => {
        if (!isMounted) {
          return;
        }

        setAdminUsers(nextUsers);
        setSelectedEmail((currentEmail) => {
          if (currentEmail && nextUsers.some((entry) => entry.email === currentEmail)) {
            return currentEmail;
          }

          return nextUsers[0]?.email ?? '';
        });

        if (nextUsers.length === 0) {
          setUsersFeedback('No hay usuarios registrados en Auth.');
          setUserCatalog(null);
          setSelectedSectionId('');
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUsersFeedback('No se pudo leer el listado de usuarios.');
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setIsLoadingEmails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAdminUser]);

  useEffect(() => {
    if (!isAdminUser || !selectedEmail) {
      setUserCatalog(null);
      setSelectedSectionId('');
      return;
    }

    let isMounted = true;
    setIsLoadingCatalog(true);
    setUsersFeedback('');

    void fetchAdminUserCatalog(selectedEmail)
      .then((catalog) => {
        if (!isMounted) {
          return;
        }

        setUserCatalog(catalog);
        setSelectedSectionId((currentSectionId) => {
          if (currentSectionId && catalog.sections.some((section) => section.id === currentSectionId)) {
            return currentSectionId;
          }

          return catalog.sections[0]?.id ?? '';
        });

        if (catalog.sections.length === 0) {
          setUsersFeedback('El usuario seleccionado no tiene categorias.');
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUsersFeedback('No se pudo cargar el detalle del usuario seleccionado.');
        setUserCatalog(null);
        setSelectedSectionId('');
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setIsLoadingCatalog(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAdminUser, selectedEmail]);

  const loadFirstPaymentsPage = useCallback(async (): Promise<void> => {
    if (!isAdminUser) {
      return;
    }

    setIsLoadingPayments(true);
    setPaymentsFeedback('');

    try {
      const page = await fetchAdminPaymentsUsers({
        limit: PAYMENTS_PAGE_SIZE,
      });

      setPaymentUsers(page.users);
      setPaymentsNextPageToken(page.nextPageToken);
      if (page.users.length === 0) {
        setPaymentsFeedback('No hay usuarios para mostrar en pagos.');
      }
    } catch {
      setPaymentsFeedback('No se pudo cargar la seccion de pagos.');
    } finally {
      setIsLoadingPayments(false);
    }
  }, [isAdminUser]);

  useEffect(() => {
    void loadFirstPaymentsPage();
  }, [loadFirstPaymentsPage]);

  const handleLoadMorePayments = async (): Promise<void> => {
    if (!paymentsNextPageToken || isLoadingMorePayments || !isAdminUser) {
      return;
    }

    setIsLoadingMorePayments(true);
    setPaymentsFeedback('');

    try {
      const page = await fetchAdminPaymentsUsers({
        limit: PAYMENTS_PAGE_SIZE,
        pageToken: paymentsNextPageToken,
      });

      setPaymentUsers((current) => [...current, ...page.users]);
      setPaymentsNextPageToken(page.nextPageToken);
    } catch {
      setPaymentsFeedback('No se pudieron cargar mas usuarios.');
    } finally {
      setIsLoadingMorePayments(false);
    }
  };

  const selectedSection = useMemo(
    () =>
      userCatalog?.sections.find((section) => section.id === selectedSectionId) ??
      null,
    [selectedSectionId, userCatalog],
  );

  if (!isAdminUser) {
    return null;
  }

  const handleEmailChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedEmail(event.target.value);
    setExpandedImage(null);
  };

  return (
    <div className="page-stack admin-page">
      <section className="panel admin-panel-head">
        <div className="panel-head">
          <h2>Administrador Exito Azul</h2>
          <p>
            Correo autorizado: <strong>{ADMIN_EMAIL}</strong>
          </p>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Secciones principales">
          <button
            type="button"
            className={activeTab === 'usuarios' ? 'admin-tab-btn active' : 'admin-tab-btn'}
            onClick={() => setActiveTab('usuarios')}
          >
            Usuarios
          </button>
          <button
            type="button"
            className={activeTab === 'pagos' ? 'admin-tab-btn active' : 'admin-tab-btn'}
            onClick={() => setActiveTab('pagos')}
          >
            Pagos
          </button>
        </div>
      </section>

      {activeTab === 'usuarios' && (
        <section className="panel admin-users-panel">
          <div className="panel-head">
            <h3>Usuarios</h3>
            <p>Selecciona un correo para ver sus categorias e imagenes.</p>
          </div>

          <label className="admin-select-label">
            Correo del usuario
            <select
              className="admin-select"
              value={selectedEmail}
              onChange={handleEmailChange}
              disabled={isLoadingEmails || adminUsers.length === 0}
            >
              {adminUsers.length === 0 ? (
                <option value="">Sin usuarios</option>
              ) : (
                adminUsers.map((adminUser) => (
                  <option key={adminUser.uid} value={adminUser.email}>
                    {adminUser.email}
                  </option>
                ))
              )}
            </select>
          </label>

          {(isLoadingEmails || isLoadingCatalog) && (
            <p className="inline-note">Cargando informacion de usuarios...</p>
          )}
          {usersFeedback && <p className="inline-note warning-note">{usersFeedback}</p>}

          {userCatalog && (
            <div className="admin-users-content">
              <section className="admin-subpanel">
                <h4>Categorias de {userCatalog.user.email}</h4>
                <div className="admin-category-grid">
                  {userCatalog.sections.map((section) => (
                    <button
                      type="button"
                      key={section.id}
                      className={
                        section.id === selectedSectionId
                          ? 'admin-category-card active'
                          : 'admin-category-card'
                      }
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setExpandedImage(null);
                      }}
                    >
                      <div className="admin-category-cover">
                        {section.coverImage ? (
                          <img
                            src={section.coverImage.thumbnailUrl || section.coverImage.previewUrl}
                            alt={section.coverImage.fileName}
                            loading="lazy"
                          />
                        ) : (
                          <span>Sin imagen</span>
                        )}
                      </div>
                      <h5>{section.name}</h5>
                      <p>{section.imageCount} imagen(es)</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="admin-subpanel">
                <h4>
                  {selectedSection ? `Imagenes de ${selectedSection.name}` : 'Selecciona una categoria'}
                </h4>

                {selectedSection && selectedSection.images.length > 0 ? (
                  <>
                    <div className="admin-image-grid">
                      {selectedSection.images.map((image) => (
                        <article key={image.id} className="admin-image-card">
                          <button
                            type="button"
                            className="admin-image-button"
                            onClick={() => {
                              setExpandedImage(image);
                            }}
                            aria-label={`Ampliar ${image.fileName}`}
                          >
                            <img
                              src={image.thumbnailUrl || image.previewUrl}
                              alt={image.fileName}
                              loading="lazy"
                            />
                          </button>
                          <p>{image.fileName}</p>
                        </article>
                      ))}
                    </div>

                    {selectedSection.imageCount > selectedSection.images.length && (
                      <p className="inline-note">
                        Mostrando {selectedSection.images.length} de {selectedSection.imageCount} imagenes.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="empty-state">
                    {selectedSection
                      ? 'Esta categoria no tiene imagenes.'
                      : 'Selecciona una categoria para ver sus imagenes.'}
                  </p>
                )}
              </section>
            </div>
          )}
        </section>
      )}

      {activeTab === 'pagos' && (
        <section className="panel admin-payments-panel">
          <div className="panel-head">
            <h3>Pagos</h3>
            <p>Se listan 10 usuarios y puedes cargar mas con el boton "Mas".</p>
          </div>

          {isLoadingPayments ? (
            <p className="inline-note">Cargando usuarios de pagos...</p>
          ) : (
            <>
              {paymentUsers.length > 0 ? (
                <div className="admin-payments-grid">
                  {paymentUsers.map((paymentUser) => (
                    <article className="admin-payment-card" key={paymentUser.uid}>
                      <h4>{paymentUser.email}</h4>
                      <p>UID: {paymentUser.uid}</p>
                      <p>Alta: {formatIsoDate(paymentUser.createdAtIso)}</p>
                      <p>Ultimo ingreso: {formatIsoDate(paymentUser.lastSignInIso)}</p>
                      <p>{paymentUser.disabled ? 'Estado: bloqueado' : 'Estado: activo'}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No hay usuarios para mostrar.</p>
              )}

              {paymentsNextPageToken && (
                <div className="gallery-more-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      void handleLoadMorePayments();
                    }}
                    disabled={isLoadingMorePayments}
                  >
                    {isLoadingMorePayments ? 'Cargando...' : 'Mas'}
                  </button>
                </div>
              )}
            </>
          )}

          {paymentsFeedback && <p className="inline-note warning-note">{paymentsFeedback}</p>}
        </section>
      )}

      {expandedImage && (
        <div
          className="admin-image-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen ampliada de ${expandedImage.fileName}`}
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="admin-image-modal-card"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="admin-image-modal-close"
              onClick={() => setExpandedImage(null)}
            >
              Cerrar
            </button>
            <img src={expandedImage.previewUrl} alt={expandedImage.fileName} />
            <p>{expandedImage.fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;

